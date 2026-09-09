import { GetShopStoresService } from './get-stores.service';
import { DatabaseService } from '@/infrustructure/database/database.service';

describe('GetShopStoresService', () => {
    it('отдаёт список складов из MoySkladStore, отсортированный по имени', async () => {
        const findMany = jest.fn().mockResolvedValue([
            { id: 'store-2', name: 'Склад Б' },
            { id: 'store-1', name: 'Склад А' },
        ]);
        const db = {
            moySkladStore: { findMany },
        } as unknown as DatabaseService;
        const service = new GetShopStoresService(db);

        const result = await service.list();

        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            }),
        );
        expect(result).toEqual([
            { id: 'store-2', name: 'Склад Б' },
            { id: 'store-1', name: 'Склад А' },
        ]);
    });

    it('для пустого справочника складов возвращает пустой массив', async () => {
        const findMany = jest.fn().mockResolvedValue([]);
        const db = {
            moySkladStore: { findMany },
        } as unknown as DatabaseService;
        const service = new GetShopStoresService(db);

        const result = await service.list();

        expect(result).toEqual([]);
    });
});
