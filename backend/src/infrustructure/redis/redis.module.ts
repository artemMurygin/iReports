import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';
import { RedisLifecycleService } from './redis-lifecycle.service';

export { REDIS_CLIENT } from './redis-client.token';

@Global()
@Module({
    providers: [
        {
            provide: REDIS_CLIENT,
            useFactory: (): Redis => {
                const logger = new Logger('RedisModule');
                const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
                const client = new Redis(url, {
                    // Guard'ы (SessionAuthGuard) должны сами решать, что делать
                    // при недоступности Redis (fail-closed, design.md Decision
                    // 10) — ioredis не должен бесконечно ретраить и блокировать
                    // запрос дольше разумного.
                    maxRetriesPerRequest: 1,
                    retryStrategy: (times: number) =>
                        Math.min(times * 200, 2_000),
                    lazyConnect: false,
                });
                // Не чаще одного warn в 30 с: при реконнектах ioredis шлёт
                // 'error' на каждую попытку и засоряет логи.
                const warnIntervalMs = 30_000;
                let lastWarnAt = 0;
                let degraded = false;
                client.on('connect', () =>
                    logger.log('Подключение к Redis установлено'),
                );
                client.on('error', (err) => {
                    degraded = true;
                    const now = Date.now();
                    if (now - lastWarnAt < warnIntervalMs) {
                        return;
                    }
                    lastWarnAt = now;
                    logger.warn({ err }, 'Ошибка соединения с Redis');
                });
                client.on('ready', () => {
                    if (!degraded) {
                        return;
                    }
                    degraded = false;
                    logger.log('Соединение с Redis восстановлено');
                });
                return client;
            },
        },
        RedisLifecycleService,
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule {}
