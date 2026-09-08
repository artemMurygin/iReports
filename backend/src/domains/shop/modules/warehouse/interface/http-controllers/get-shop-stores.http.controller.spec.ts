import { GetShopStoresHttpController } from './get-shop-stores.http.controller';
import { GetShopStoresService } from '../../application/services/get-stores.service';

describe('GetShopStoresHttpController', () => {
    it('отдаёт список складов из сервиса как есть', async () => {
        const list = jest
            .fn()
            .mockResolvedValue([{ id: 'store-1', name: 'Основной склад' }]);
        const service = { list } as unknown as GetShopStoresService;
        const controller = new GetShopStoresHttpController(service);

        const result = await controller.get();

        expect(list).toHaveBeenCalledTimes(1);
        expect(result).toEqual([{ id: 'store-1', name: 'Основной склад' }]);
    });

    it('для пустого справочника возвращает пустой массив', async () => {
        const list = jest.fn().mockResolvedValue([]);
        const service = { list } as unknown as GetShopStoresService;
        const controller = new GetShopStoresHttpController(service);

        const result = await controller.get();

        expect(result).toEqual([]);
    });
});
