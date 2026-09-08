import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';

// ioredis не реализует OnModuleDestroy сам по себе — без явного .quit()
// соединение держит event loop открытым бесконечно (актуально для
// одноразовых скриптов вроде seedPermissions.ts, которые должны штатно
// завершаться после app.close()).
@Injectable()
export class RedisLifecycleService implements OnModuleDestroy {
    constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

    async onModuleDestroy(): Promise<void> {
        await this.client.quit().catch(() => this.client.disconnect());
    }
}
