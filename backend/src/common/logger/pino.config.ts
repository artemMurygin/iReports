import { LoggerOptions, TransportTargetOptions } from 'pino';
import { Options } from 'pino-http';

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? 'info';

function buildTransportTargets(): TransportTargetOptions[] {
  const targets: TransportTargetOptions[] = [];

  if (isProd) {
    // Явный stdout-таргет обязателен: раз указан transport.targets, pino больше
    // не пишет в stdout по умолчанию. Без этого таргета простой отказ Loki
    // означал бы полное отсутствие логов даже в `docker compose logs backend`.
    targets.push({ target: 'pino/file', level, options: { destination: 1 } });
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
      // Недоступность Loki не должна ронять приложение и не должна спамить процесс ошибками.
      silenceErrors: true,
    },
  });

  return targets;
}

export function buildPinoBaseOptions(): LoggerOptions {
  return {
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
    transport: { targets: buildTransportTargets() },
  };
}

export function buildPinoHttpOptions(): Options {
  return {
    ...buildPinoBaseOptions(),
    customProps: () => ({ context: 'HTTP' }),
    customSuccessMessage: (req, res, responseTime) =>
      `${req.method} ${req.url} ${res.statusCode} — ${responseTime}ms`,
    customErrorMessage: (req, res, error) =>
      `${req.method} ${req.url} ${res.statusCode} — ${error.message}`,
  };
}
