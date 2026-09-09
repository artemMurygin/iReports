import { RoappSyncService } from './roapp-sync.service';
import type { RoappGateway } from '../../integrations/roapp-gateway/roapp-gateway.port';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// spec: service/goods-turnover — задача 4.5 change service-turnover-report.
// uploadWarehouses() — апсерт справочника складов в roapp_warehouses,
// по образцу uploadProductCategories()/uploadEmployees(): полностью
// перезаписывает name существующей записи, создаёт новую при отсутствии.
describe('RoappSyncService.uploadWarehouses', () => {
    const buildService = (warehouses: { id: number; name: string }[]) => {
        const upsert = jest.fn().mockResolvedValue(undefined);
        const db = {
            roappWarehouse: { upsert },
        } as unknown as DatabaseService;
        const fetchWarehouses = jest.fn().mockResolvedValue(warehouses);
        const gateway = { fetchWarehouses } as unknown as RoappGateway;

        return {
            service: new RoappSyncService(db, gateway),
            upsert,
            fetchWarehouses,
        };
    };

    it('апсертит каждый склад из RoappGateway.fetchWarehouses', async () => {
        const { service, upsert, fetchWarehouses } = buildService([
            { id: 1, name: 'Основной склад' },
            { id: 2, name: 'Склад запчастей' },
        ]);

        await service.uploadWarehouses();

        expect(fetchWarehouses).toHaveBeenCalledTimes(1);
        expect(upsert).toHaveBeenCalledTimes(2);
        expect(upsert).toHaveBeenCalledWith({
            where: { id: 1 },
            create: { id: 1, name: 'Основной склад' },
            update: { name: 'Основной склад' },
        });
        expect(upsert).toHaveBeenCalledWith({
            where: { id: 2 },
            create: { id: 2, name: 'Склад запчастей' },
            update: { name: 'Склад запчастей' },
        });
    });

    it('возвращает количество засинканных складов', async () => {
        const { service } = buildService([{ id: 1, name: 'Основной склад' }]);

        await expect(service.uploadWarehouses()).resolves.toBe(1);
    });

    it('ничего не апсертит, если справочник складов пуст', async () => {
        const { service, upsert } = buildService([]);

        await expect(service.uploadWarehouses()).resolves.toBe(0);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('пробрасывает ошибку, если получение складов упало', async () => {
        const db = {
            roappWarehouse: { upsert: jest.fn() },
        } as unknown as DatabaseService;
        const gateway = {
            fetchWarehouses: jest
                .fn()
                .mockRejectedValue(new Error('Roapp недоступен')),
        } as unknown as RoappGateway;
        const service = new RoappSyncService(db, gateway);

        await expect(service.uploadWarehouses()).rejects.toThrow(
            'Roapp недоступен',
        );
    });
});
