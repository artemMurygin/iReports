import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/infrustructure/redis/redis.module';
import type {
    LastScheduledImportRun,
    LastScheduledImportStore,
} from '../../application/ports/last-scheduled-import-store.port';

export const LAST_SCHEDULED_IMPORT_KEY = 'price-import:schedule:last-run';

// Redis-реализация LAST_SCHEDULED_IMPORT_STORE: одно JSON-значение, без TTL.
// spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
@Injectable()
export class RedisLastScheduledImportStore implements LastScheduledImportStore {
    constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

    async save(run: LastScheduledImportRun): Promise<void> {
        await this.client.set(LAST_SCHEDULED_IMPORT_KEY, JSON.stringify(run));
    }

    async get(): Promise<LastScheduledImportRun | null> {
        const raw = await this.client.get(LAST_SCHEDULED_IMPORT_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Partial<LastScheduledImportRun>;
            if (
                (parsed.status === 'success' || parsed.status === 'error') &&
                typeof parsed.finishedAt === 'number'
            ) {
                return { status: parsed.status, finishedAt: parsed.finishedAt };
            }
            return null;
        } catch {
            return null;
        }
    }
}
