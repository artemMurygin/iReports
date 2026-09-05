import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';

// DI-токен клиента Redis — по аналогии с UNIT_OF_WORK/DatabaseModule
// (см. backend/src/infrustructure/database/database.module.ts). Redis
// впервые появляется в проекте этой фичей (design.md, Decision 6): единый
// клиент на всё приложение, пространство ключей сессий (session:<id>,
// employee_sessions:<bitrixEmployeeId>) — за модулем session, будущие
// фичи кэширования переиспользуют этот же клиент, а не заводят второй.
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

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
                    retryStrategy: (times: number) => Math.min(times * 200, 2_000),
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
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule {}
