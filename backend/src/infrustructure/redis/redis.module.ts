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
                client.on('connect', () =>
                    logger.log(`Подключение к Redis установлено (${url})`),
                );
                client.on('error', (err) =>
                    logger.warn(`Ошибка соединения с Redis: ${err.message}`),
                );
                return client;
            },
        },
        RedisLifecycleService,
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule {}
