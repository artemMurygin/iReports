import { BadGatewayException } from '@nestjs/common';
import { RoappService } from './roapp.service';
import type { RoappHttpService } from './roapp.instace';

// spec: service/goods-turnover — задача 4.1 change service-turnover-report
// (обновлено: реальный вызов RemOnline вместо ручного справочника
// ROAPP_WAREHOUSES, см. roapp.service.ts). Эндпоинт вне версионирования
// v2 (`GET https://api.roapp.io/warehouse/`, документация
// https://roapp.readme.io/v1.4/reference/get-warehouses) — HTTP-клиент
// замокан целиком (get — jest.fn()), по образцу
// custom-api-roapp.service.spec.ts.
describe('RoappService.fetchWarehouses', () => {
    let get: jest.Mock;
    let service: RoappService;

    beforeEach(() => {
        get = jest.fn();
        const roApp = { instance: { get } } as unknown as RoappHttpService;
        service = new RoappService(roApp);
    });

    const apiResponse = {
        data: [
            {
                id: 38107,
                title: 'Основной склад',
                is_global: false,
                type: 'product',
            },
            {
                id: 2390668,
                title: 'Склад запчастей',
                is_global: false,
                type: 'product',
            },
        ],
        count: 2,
        success: true,
    };

    it('запрашивает GET https://api.roapp.io/warehouse/ с type=product', async () => {
        get.mockResolvedValueOnce({ data: apiResponse });

        await service.fetchWarehouses();

        expect(get).toHaveBeenCalledWith('https://api.roapp.io/warehouse/', {
            params: { type: 'product' },
        });
    });

    it('возвращает список складов в форме [{id, name}], name = title', async () => {
        get.mockResolvedValueOnce({ data: apiResponse });

        const warehouses = await service.fetchWarehouses();

        expect(warehouses).toEqual([
            { id: 38107, name: 'Основной склад' },
            { id: 2390668, name: 'Склад запчастей' },
        ]);
    });

    it('пустой список складов -> пустой массив, не ошибка', async () => {
        get.mockResolvedValueOnce({
            data: { data: [], count: 0, success: true },
        });

        await expect(service.fetchWarehouses()).resolves.toEqual([]);
    });

    it('ответ, не проходящий Zod-валидацию, -> BadGatewayException', async () => {
        get.mockResolvedValueOnce({
            data: { data: [{ id: 1 }], count: 1, success: true },
        });

        const error = await service.fetchWarehouses().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BadGatewayException);
    });

    it('сбой HTTP-вызова -> BadGatewayException', async () => {
        get.mockRejectedValueOnce(new Error('502 Bad Gateway'));

        const error = await service.fetchWarehouses().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BadGatewayException);
    });
});
