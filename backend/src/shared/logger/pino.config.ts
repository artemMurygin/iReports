import { nanoid } from 'nanoid';
import pino, { LoggerOptions, TransportTargetOptions } from 'pino';
import type { Options } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'http';
import { RequestContextService } from '../application/context/AppRequestContext';
import { errSerializer } from './serializers';
import { routeLabel } from './http-route';

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? 'info';

// Служебные сообщения Nest при старте (маппинг роутов/инициализация модулей) —
// сотни строк, не несущих пользы в Loki.
const DROPPED_CONTEXTS = new Set([
    'InstanceLoader',
    'RoutesResolver',
    'RouterExplorer',
]);

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type Req = IncomingMessage & {
    id?: string | number;
    originalUrl?: string;
    route?: { path?: string };
    user?: { employeeId?: number };
    authenticatedViaApiKey?: boolean;
    cookies?: Record<string, string>;
};
type Res = ServerResponse & {
    locals?: { errorCode?: string };
};

function buildTransportTargets(): TransportTargetOptions[] {
    const targets: TransportTargetOptions[] = [];

    if (isProd) {
        // Явный stdout-таргет обязателен: раз указан transport.targets, pino больше
        // не пишет в stdout по умолчанию. Без этого таргета простой отказ Loki
        // означал бы полное отсутствие логов даже в `docker compose logs backend`.
        targets.push({
            target: 'pino/file',
            level,
            options: { destination: 1 },
        });
    } else {
        targets.push({
            target: 'pino-pretty',
            level,
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                singleLine: true,
            },
        });
    }

    targets.push({
        target: 'pino-loki',
        level,
        options: {
            host: process.env.LOKI_HOST ?? 'http://loki:3100',
            batching: { interval: 5 },
            labels: {
                app: 'ireports-backend',
                env: process.env.NODE_ENV ?? 'development',
            },
            // context — низкокардинальный label (имя класса), по нему фильтруют в Grafana.
            propsToLabels: ['context'],
            // Недоступность Loki не должна ронять приложение и не должна спамить процесс ошибками.
            silenceErrors: true,
            // time в строке — ISO-строка (по контракту), а pino-loki умножает его как число
            // и получает NaN, из-за чего Loki отклоняет записи. Берём время отправки в транспорте.
            replaceTimestamp: true,
        },
    });

    return targets;
}

/** Базовые опции pino (без pino-http); transport подключается здесь. */
export function buildPinoBaseOptions(): LoggerOptions {
    return {
        level,
        base: null,
        timestamp: pino.stdTimeFunctions.isoTime,
        // Root-логгер используется и вне HTTP-контекста (cron, синки, события), где
        // serializers pino-http не действуют: без этого AxiosError пишется целиком
        // (с заголовками и токенами).
        serializers: { err: errSerializer },
        // Подстраховка: плоские HTTP-поля заголовков не содержат, но
        // сторонний код может залогировать объект с ними.
        redact: {
            paths: [
                '*.authorization',
                '*.cookie',
                'err.config.headers',
                'req.headers',
            ],
            censor: '[REDACTED]',
        },
        mixin() {
            // Явные поля лога приоритетнее mixin (дефолтная стратегия слияния pino).
            const requestId = RequestContextService.tryGetRequestId();
            return requestId ? { requestId } : {};
        },
        hooks: {
            logMethod(args, method) {
                const first = args[0];
                if (
                    first !== null &&
                    typeof first === 'object' &&
                    DROPPED_CONTEXTS.has(
                        (first as { context?: string }).context ?? '',
                    )
                ) {
                    return;
                }
                method.apply(this, args);
            },
        },
        transport: { targets: buildTransportTargets() },
    };
}

function pathOf(req: Req): string {
    return (req.originalUrl ?? req.url ?? '').split('?')[0];
}

function authOf(req: Req): 'session' | 'api-key' | 'none' {
    if (req.user?.employeeId === undefined) {
        return 'none';
    }
    return req.authenticatedViaApiKey ? 'api-key' : 'session';
}

function httpIdentity(req: Req): Record<string, unknown> {
    return { context: 'HTTP', requestId: req.id };
}

function responseFields(req: Req, res: Res): Record<string, unknown> {
    return {
        method: req.method,
        path: pathOf(req),
        route: routeLabel(req),
        status: res.statusCode,
        employeeId: req.user?.employeeId,
        auth: authOf(req),
    };
}

/** Опции pino-http без поля logger (его добавляет buildLoggerModuleParams). */
export function buildHttpLoggerOptions(): Omit<Options, 'logger'> {
    return {
        genReqId(req, res) {
            const header = req.headers['x-request-id'];
            const id =
                typeof header === 'string' && REQUEST_ID_PATTERN.test(header)
                    ? header
                    : nanoid(6);
            res.setHeader('x-request-id', id);
            return id;
        },
        // Внутри middleware Nest обрезает req.url до '/', настоящий путь — originalUrl.
        autoLogging: {
            ignore: (req) => pathOf(req as Req) === '/metrics',
        },
        customLogLevel(_req, res, err) {
            if (err || res.statusCode >= 500) {
                return 'error';
            }
            return res.statusCode >= 400 ? 'warn' : 'info';
        },
        // customProps не используем: они попадают в child-bindings, а mixin снова
        // добавляет requestId — получились бы дубли ключей. context/requestId
        // кладём прямо в объект HTTP-лога ниже, а app-логи получают context от Nest Logger.
        customAttributeKeys: { responseTime: 'durationMs' },
        // Плоские поля вместо вложенных req/res: undefined pino опускает.
        serializers: {
            req: () => undefined,
            res: () => undefined,
            err: errSerializer,
        },
        customSuccessObject(req, res, obj) {
            const base = obj as Record<string, unknown>;
            return {
                ...base,
                ...httpIdentity(req as Req),
                ...responseFields(req as Req, res),
            };
        },
        customErrorObject(req, res, _err, obj) {
            // err сериализует errSerializer (serializers выше); стек для 4xx
            // он убирает по флагу, который ставит AllExceptionsFilter.
            const errorCode = (res as Res).locals?.errorCode;
            const base = obj as Record<string, unknown>;
            return {
                ...base,
                ...httpIdentity(req as Req),
                ...responseFields(req as Req, res),
                ...(errorCode ? { errorCode } : {}),
            };
        },
        customSuccessMessage(req, res, responseTime) {
            return `${req.method} ${pathOf(req as Req)} ${res.statusCode} ${Math.round(responseTime)}ms`;
        },
        customErrorMessage(req, res, err) {
            return `${req.method} ${pathOf(req as Req)} ${res.statusCode} — ${err.message}`;
        },
    };
}

/**
 * nestjs-pino создаёт два root-логгера, если отдать ему сырые опции, поэтому
 * передаём готовый инстанс pino.
 */
export function buildLoggerModuleParams() {
    return {
        pinoHttp: {
            logger: pino(buildPinoBaseOptions()),
            ...buildHttpLoggerOptions(),
        },
    };
}
