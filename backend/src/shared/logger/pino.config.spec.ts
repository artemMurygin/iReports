import { createServer, get, Server } from 'http';
import { AddressInfo } from 'net';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { RequestContext } from 'nestjs-request-context';
import { buildHttpLoggerOptions, buildPinoBaseOptions } from './pino.config';
import { errSerializer } from './serializers';
import { markStackOmitted } from './omit-stack';

function makeLogger() {
    const lines: Record<string, unknown>[] = [];
    const rawLines: string[] = [];
    // Без transport: пишем в память, чтобы проверять итоговый JSON.
    const options = { ...buildPinoBaseOptions(), transport: undefined };
    const logger = pino(options, {
        write: (chunk: string) => {
            rawLines.push(chunk);
            lines.push(JSON.parse(chunk) as Record<string, unknown>);
        },
    });
    return { logger, lines, rawLines };
}

describe('pino.config', () => {
    describe('base options', () => {
        it('отбрасывает записи служебных контекстов Nest', () => {
            const { logger, lines } = makeLogger();
            logger.info({ context: 'InstanceLoader' }, 'Module initialized');
            logger.info({ context: 'RoutesResolver' }, 'Mapped');
            logger.info({ context: 'RouterExplorer' }, 'Mapped route');
            logger.info({ context: 'Other' }, 'kept');
            expect(lines).toHaveLength(1);
            expect(lines[0].context).toBe('Other');
        });

        it('mixin добавляет requestId внутри RequestContext и не затирает явное поле', () => {
            const { logger, lines } = makeLogger();
            logger.info('вне контекста');
            RequestContext.cls.run(
                { req: { requestId: 'abc123' } } as unknown as RequestContext,
                () => {
                    logger.info('внутри');
                    logger.info({ requestId: 'explicit' }, 'явное поле');
                },
            );
            expect(lines[0].requestId).toBeUndefined();
            expect(lines[1].requestId).toBe('abc123');
            expect(lines[2].requestId).toBe('explicit');
        });

        it('не пишет base-поля и использует ISO-время', () => {
            const { logger, lines } = makeLogger();
            logger.info('x');
            expect(lines[0].pid).toBeUndefined();
            expect(lines[0].hostname).toBeUndefined();
            expect(typeof lines[0].time).toBe('string');
        });
    });

    describe('root-логгер вне HTTP-контекста', () => {
        it('не пишет заголовки/request AxiosError и усекает response.data', () => {
            const { logger, lines } = makeLogger();
            const err = Object.assign(new Error('Request failed'), {
                config: {
                    method: 'get',
                    url: 'https://api.test/x',
                    headers: { Authorization: 'Bearer secret1' },
                },
                request: { _header: 'Authorization: Bearer secret2' },
                response: {
                    status: 502,
                    data: 'x'.repeat(5000),
                    config: { headers: { Authorization: 'Bearer secret3' } },
                },
            });
            logger.error({ err }, 'cron failed');
            const out = JSON.stringify(lines[0]);
            expect(out).not.toContain('secret');
            expect(out).not.toContain('_header');
            const logged = lines[0].err as {
                response: { data: string };
            };
            expect(logged.response.data.length).toBeLessThanOrEqual(1030);
        });

        // Verifies pino-loki NaN-timestamp fix: ISO time не должен разбираться транспортом.
        it('таргет pino-loki использует replaceTimestamp', () => {
            const transport = buildPinoBaseOptions().transport as {
                targets: { target: string; options: Record<string, unknown> }[];
            };
            const loki = transport.targets.find(
                (t) => t.target === 'pino-loki',
            );
            expect(loki?.options.replaceTimestamp).toBe(true);
        });
    });

    describe('errSerializer', () => {
        it('AxiosError-подобный объект сериализуется без headers и request', () => {
            const err = Object.assign(new Error('Request failed'), {
                code: 'ERR_BAD_RESPONSE',
                config: {
                    method: 'get',
                    url: 'https://api.test/x',
                    headers: { Authorization: 'Bearer secret' },
                },
                request: { socket: {} },
                response: { status: 502, data: { big: 'x'.repeat(5000) } },
            });
            const out = JSON.stringify(errSerializer(err));
            expect(out).not.toContain('secret');
            expect(out).not.toContain('headers');
            expect(out).not.toContain('"request"');
            const parsed = JSON.parse(out) as {
                config: { method: string; url: string };
                response: { status: number; data: string };
            };
            expect(parsed.config).toEqual({
                method: 'get',
                url: 'https://api.test/x',
            });
            expect(parsed.response.status).toBe(502);
            expect(parsed.response.data.length).toBeLessThanOrEqual(1025);
        });

        it('принимает pre-serialized объект с .raw', () => {
            const raw = new Error('boom');
            const out = errSerializer({
                type: 'Error',
                message: 'boom',
                stack: 's',
                raw,
            }) as Record<string, unknown>;
            expect(out.message).toBe('boom');
            expect(out.raw).toBeUndefined();
        });
    });

    describe('HTTP-лог (pino-http)', () => {
        let server: Server;
        let lines: Record<string, unknown>[];
        let rawLines: string[];

        beforeEach(async () => {
            const made = makeLogger();
            lines = made.lines;
            rawLines = made.rawLines;
            const mw = pinoHttp({
                logger: made.logger,
                ...buildHttpLoggerOptions(),
            });
            server = createServer((req, res) => {
                mw(req, res);
                if (req.url?.startsWith('/fail')) {
                    // Как AllExceptionsFilter: для 4xx помечает ошибку
                    // «без стека» и отдаёт её pino-http через res.err.
                    const error = new Error('nope');
                    markStackOmitted(error);
                    (res as unknown as { err: Error }).err = error;
                    res.statusCode = 404;
                }
                res.end('ok');
            });
            await new Promise<void>((r) => server.listen(0, r));
        });
        afterEach(() => server.close());

        function request(path: string): Promise<void> {
            const { port } = server.address() as AddressInfo;
            return new Promise((resolve) => {
                get(
                    {
                        port,
                        path,
                        headers: { authorization: 'Bearer secret' },
                    },
                    (res) => {
                        res.resume();
                        res.on('end', () => setTimeout(resolve, 20));
                    },
                );
            });
        }

        it('пишет плоскую строку без req/res/headers', async () => {
            await request('/v1/ping?token=1');
            expect(lines).toHaveLength(1);
            const line = lines[0];
            expect(line.req).toBeUndefined();
            expect(line.res).toBeUndefined();
            expect(JSON.stringify(line)).not.toContain('secret');
            expect(line).toMatchObject({
                context: 'HTTP',
                method: 'GET',
                path: '/v1/ping',
                route: 'unmatched',
                status: 200,
                auth: 'none',
            });
            expect(typeof line.durationMs).toBe('number');
            expect(typeof line.requestId).toBe('string');
            expect(line.msg).toMatch(/^GET \/v1\/ping 200 \d+ms$/);
        });

        it('HTTP-строка не содержит дублирующихся ключей', async () => {
            await request('/v1/ping');
            expect(rawLines).toHaveLength(1);
            const raw = rawLines[0];
            expect(raw.match(/"requestId"/g)).toHaveLength(1);
            expect(raw.match(/"context"/g)).toHaveLength(1);
        });

        it('4xx логируется как warn без stack в err', async () => {
            await request('/fail');
            expect(lines[0].level).toBe(40);
            const err = lines[0].err as Record<string, unknown>;
            expect(err.message).toBe('nope');
            expect(err.stack).toBeUndefined();
            expect(lines[0].msg).toBe('GET /fail 404 — nope');
        });

        it('не логирует /metrics', async () => {
            await request('/metrics');
            expect(lines).toHaveLength(0);
        });
    });
});
