import type Redis from 'ioredis';
import {
    LAST_FILE_NAME_KEY,
    RedisPriceListVersionStore,
} from './redis-price-list-version.store';

// spec: shop/price-import-schedule#выгрузка-только-при-изменении-прайса
describe('RedisPriceListVersionStore', () => {
    const makeStore = () => {
        const client = { get: jest.fn(), set: jest.fn() };
        const store = new RedisPriceListVersionStore(
            client as unknown as Redis,
        );
        return { client, store };
    };

    it('использует стабильный ключ без привязки к дате', () => {
        expect(LAST_FILE_NAME_KEY).toBe('price-import:schedule:last-file-name');
    });

    it('getLastUploadedName: возвращает сохранённое название', async () => {
        const { client, store } = makeStore();
        client.get.mockResolvedValue('price_2026-10-06.xlsx');

        await expect(store.getLastUploadedName()).resolves.toBe(
            'price_2026-10-06.xlsx',
        );
        expect(client.get).toHaveBeenCalledWith(LAST_FILE_NAME_KEY);
    });

    it('getLastUploadedName: null, если автоматических выгрузок ещё не было', async () => {
        const { client, store } = makeStore();
        client.get.mockResolvedValue(null);

        await expect(store.getLastUploadedName()).resolves.toBeNull();
    });

    it('saveUploadedName: пишет название без TTL', async () => {
        const { client, store } = makeStore();
        client.set.mockResolvedValue('OK');

        await store.saveUploadedName('price.xlsx');

        expect(client.set).toHaveBeenCalledTimes(1);
        expect(client.set).toHaveBeenCalledWith(LAST_FILE_NAME_KEY, 'price.xlsx');
    });
});
