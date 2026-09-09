import { RoappService } from './roapp.service';
import type { RoappHttpService } from './roapp.instace';

// spec: service/goods-turnover — задача 4.1 change service-turnover-report.
// fetchWarehouses() не вызывает публичное API RemOnline (допущение design.md
// D3 не подтвердилось, см. roapp-warehouses.config.ts) — читает резервный
// источник, ручной справочник в ROAPP_WAREHOUSES. Тестируем именно этот
// контракт: форма ответа = [{id, name}], пустой список без конфигурации,
// fail-fast при некорректном значении переменной.
describe('RoappService.fetchWarehouses', () => {
    const originalEnv = process.env.ROAPP_WAREHOUSES;

    const buildService = () => new RoappService({} as RoappHttpService);

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.ROAPP_WAREHOUSES;
        } else {
            process.env.ROAPP_WAREHOUSES = originalEnv;
        }
    });

    it('возвращает список складов, заданный в ROAPP_WAREHOUSES', async () => {
        process.env.ROAPP_WAREHOUSES = JSON.stringify([
            { id: 1, name: 'Основной склад' },
            { id: 2, name: 'Склад запчастей' },
        ]);

        const warehouses = await buildService().fetchWarehouses();

        expect(warehouses).toEqual([
            { id: 1, name: 'Основной склад' },
            { id: 2, name: 'Склад запчастей' },
        ]);
    });

    it('возвращает пустой список, если ROAPP_WAREHOUSES не задана', async () => {
        delete process.env.ROAPP_WAREHOUSES;

        await expect(buildService().fetchWarehouses()).resolves.toEqual([]);
    });

    it('падает с понятной ошибкой на невалидном JSON в ROAPP_WAREHOUSES', async () => {
        process.env.ROAPP_WAREHOUSES = '{not valid json';

        await expect(buildService().fetchWarehouses()).rejects.toThrow(
            /ROAPP_WAREHOUSES/,
        );
    });

    it('падает с понятной ошибкой на элементе неверной формы', async () => {
        process.env.ROAPP_WAREHOUSES = JSON.stringify([
            { id: 'не число', name: 'Склад' },
        ]);

        await expect(buildService().fetchWarehouses()).rejects.toThrow();
    });
});
