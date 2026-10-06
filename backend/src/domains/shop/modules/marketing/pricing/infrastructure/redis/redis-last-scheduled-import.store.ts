import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/infrustructure/redis/redis.module';
import type {
    LastScheduledImportRun,
    LastScheduledImportStore,
} from '../../application/ports/last-scheduled-import-store.port';
import type { PriceUpdateTarget } from '../config/pricing.config';

export const LAST_SCHEDULED_IMPORT_KEY = 'price-import:schedule:last-run';

/** По ключу на каждое обновление цен в МойСклад (n8n-вебхук). */
export const PRICE_UPDATE_KEYS: Record<PriceUpdateTarget, string> = {
    uploadRc: 'price-import:schedule:last-ms-upload-rc',
    uploadSale: 'price-import:schedule:last-ms-upload-sale',
};

function parseRun(raw: string | null): LastScheduledImportRun | null {
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

// Redis-реализация LAST_SCHEDULED_IMPORT_STORE: JSON-значения, без TTL.
// spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
@Injectable()
export class RedisLastScheduledImportStore implements LastScheduledImportStore {
    constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

    async save(run: LastScheduledImportRun): Promise<void> {
        await this.client.set(LAST_SCHEDULED_IMPORT_KEY, JSON.stringify(run));
    }

    async get(): Promise<LastScheduledImportRun | null> {
        return parseRun(await this.client.get(LAST_SCHEDULED_IMPORT_KEY));
    }

    async savePriceUpdate(
        target: PriceUpdateTarget,
        run: LastScheduledImportRun,
    ): Promise<void> {
        await this.client.set(PRICE_UPDATE_KEYS[target], JSON.stringify(run));
    }

    async getPriceUpdates(): Promise<
        Record<PriceUpdateTarget, LastScheduledImportRun | null>
    > {
        const [uploadRc, uploadSale] = await Promise.all([
            this.client.get(PRICE_UPDATE_KEYS.uploadRc),
            this.client.get(PRICE_UPDATE_KEYS.uploadSale),
        ]);
        return { uploadRc: parseRun(uploadRc), uploadSale: parseRun(uploadSale) };
    }
}
