import { ListWarehousesService } from './list-warehouses.service';
import type { WarehouseRepositoryPort } from '../../ports/warehouse/warehouse.port';
import { Warehouse } from '../../../domain/value-objects/warehouse.value-object';

// По образцу list-order-types.service.spec.ts (modules/reports) — плоский
// read-only справочник без параметров.
describe('ListWarehousesService', () => {
    const buildService = (warehouses: Warehouse[]) => {
        const findAll = jest
            .fn<Promise<Warehouse[]>, []>()
            .mockResolvedValue(warehouses);
        const repo: WarehouseRepositoryPort = { findAll };

        return { service: new ListWarehousesService(repo), findAll };
    };

    it('возвращает пустой список, если справочник пуст (ROAPP_WAREHOUSES не задан)', async () => {
        const { service } = buildService([]);

        const result = await service.execute();

        expect(result).toEqual([]);
    });

    it('маппит VO из порта в плоскую форму контракта', async () => {
        const { service } = buildService([
            Warehouse.create({ id: 1, name: 'Основной склад' }),
            Warehouse.create({ id: 2, name: 'Склад Санкт-Петербург' }),
        ]);

        const result = await service.execute();

        expect(result).toEqual([
            { id: 1, name: 'Основной склад' },
            { id: 2, name: 'Склад Санкт-Петербург' },
        ]);
    });
});
