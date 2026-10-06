import type Redis from 'ioredis';
import {
    LAST_SCHEDULED_IMPORT_KEY,
    PRICE_UPDATE_KEYS,
    RedisLastScheduledImportStore,
} from './redis-last-scheduled-import.store';

describe('RedisLastScheduledImportStore', () => {
    let client: { get: jest.Mock; set: jest.Mock };
    let store: RedisLastScheduledImportStore;

    beforeEach(() => {
        client = { get: jest.fn(), set: jest.fn().mockResolvedValue('OK') };
        store = new RedisLastScheduledImportStore(client as unknown as Redis);
    });

    it('save пишет JSON по ключу без TTL', async () => {
        await store.save({ status: 'success', finishedAt: 1000 });
        expect(client.set).toHaveBeenCalledWith(
            LAST_SCHEDULED_IMPORT_KEY,
            JSON.stringify({ status: 'success', finishedAt: 1000 }),
        );
    });

    it('get возвращает сохранённый запуск', async () => {
        client.get.mockResolvedValue(
            JSON.stringify({ status: 'error', finishedAt: 5 }),
        );
        await expect(store.get()).resolves.toEqual({
            status: 'error',
            finishedAt: 5,
        });
    });

    it('get → null, если ключа нет или значение битое', async () => {
        client.get.mockResolvedValueOnce(null);
        await expect(store.get()).resolves.toBeNull();
        client.get.mockResolvedValueOnce('{not json');
        await expect(store.get()).resolves.toBeNull();
        client.get.mockResolvedValueOnce(JSON.stringify({ status: 'x' }));
        await expect(store.get()).resolves.toBeNull();
    });

    // spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
    it('savePriceUpdate пишет JSON по своему ключу для каждой цели', async () => {
        await store.savePriceUpdate('uploadRc', {
            status: 'success',
            finishedAt: 1,
        });
        await store.savePriceUpdate('uploadSale', {
            status: 'error',
            finishedAt: 2,
        });

        expect(client.set).toHaveBeenCalledWith(
            PRICE_UPDATE_KEYS.uploadRc,
            JSON.stringify({ status: 'success', finishedAt: 1 }),
        );
        expect(client.set).toHaveBeenCalledWith(
            PRICE_UPDATE_KEYS.uploadSale,
            JSON.stringify({ status: 'error', finishedAt: 2 }),
        );
        expect(PRICE_UPDATE_KEYS.uploadRc).not.toBe(
            PRICE_UPDATE_KEYS.uploadSale,
        );
    });

    it('getPriceUpdates читает оба значения, пустые и битые — null', async () => {
        client.get.mockImplementation((key: string) =>
            Promise.resolve(
                key === PRICE_UPDATE_KEYS.uploadRc
                    ? JSON.stringify({ status: 'success', finishedAt: 7 })
                    : '{broken',
            ),
        );

        await expect(store.getPriceUpdates()).resolves.toEqual({
            uploadRc: { status: 'success', finishedAt: 7 },
            uploadSale: null,
        });
    });
});
