import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/infrustructure/redis/redis.module';
import type { PriceListVersionStore } from '../../application/ports/price-list-version-store.port';

// Стабильный ключ без даты: хранится одно значение — название последнего
// успешно выгруженного файла прайса.
export const LAST_FILE_NAME_KEY = 'price-import:schedule:last-file-name';

// Redis-реализация PRICE_LIST_VERSION_STORE. Без TTL: значение должно пережить
// рестарты и выходные, иначе неизменённый прайс выгрузится повторно.
// spec: shop/price-import-schedule#выгрузка-только-при-изменении-прайса
@Injectable()
export class RedisPriceListVersionStore implements PriceListVersionStore {
    constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

    async getLastUploadedName(): Promise<string | null> {
        return this.client.get(LAST_FILE_NAME_KEY);
    }

    async saveUploadedName(name: string): Promise<void> {
        await this.client.set(LAST_FILE_NAME_KEY, name);
    }
}
