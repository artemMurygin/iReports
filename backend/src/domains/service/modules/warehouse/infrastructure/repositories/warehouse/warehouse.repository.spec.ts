import { WarehouseRepository } from './warehouse.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// 8.5 (openspec/changes/service-turnover-report/tasks.md): read-репозиторий
// без бизнес-инвариантов, минимум один тест на маппинг Prisma-модели в
// доменный VO (по образцу ProductCategoryRepository/reports-справочников).
describe('WarehouseRepository', () => {
    const buildRepository = () => {
        const findMany = jest.fn();
        const client = { roappWarehouse: { findMany } };
        const db = { getClient: () => client } as unknown as DatabaseService;

        const repository = new WarehouseRepository(db);
        return { repository, findMany };
    };

    it('маппит список складов Prisma-модели в доменные VO', async () => {
        const { repository, findMany } = buildRepository();
        findMany.mockResolvedValueOnce([
            { id: 10, name: 'Основной склад' },
            { id: 20, name: 'Склад на выезде' },
        ]);

        const result = await repository.findAll();

        expect(findMany).toHaveBeenCalledWith({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        expect(result).toHaveLength(2);
        expect(result[0]?.getId()).toBe(10);
        expect(result[0]?.getName()).toBe('Основной склад');
        expect(result[1]?.getId()).toBe(20);
    });

    it('пустой справочник — пустой список, не ошибка', async () => {
        const { repository, findMany } = buildRepository();
        findMany.mockResolvedValueOnce([]);

        const result = await repository.findAll();

        expect(result).toEqual([]);
    });
});
