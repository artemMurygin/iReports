import { ProductCategoryRepository } from './product-category.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// 8.5 (openspec/changes/service-turnover-report/tasks.md): read-репозиторий
// без бизнес-инвариантов — по объёму тестов сравнимо со справочниками
// modules/reports (см. ServiceSalesRepository.listCategories), минимум один
// тест на маппинг Prisma-модели в доменный VO.
describe('ProductCategoryRepository', () => {
    const buildRepository = () => {
        const findMany = jest.fn();
        const client = { roappProductCategory: { findMany } };
        const db = { getClient: () => client } as unknown as DatabaseService;

        const repository = new ProductCategoryRepository(db);
        return { repository, findMany };
    };

    it('маппит дерево категорий Prisma-модели в доменные VO', async () => {
        const { repository, findMany } = buildRepository();
        findMany.mockResolvedValueOnce([
            { id: 1, name: 'Аккумуляторы', parentId: null },
            { id: 2, name: 'iPhone', parentId: 1 },
        ]);

        const result = await repository.findAll();

        expect(findMany).toHaveBeenCalledWith({
            select: { id: true, name: true, parentId: true },
        });
        expect(result).toHaveLength(2);
        expect(result[0]?.getId()).toBe(1);
        expect(result[0]?.getName()).toBe('Аккумуляторы');
        expect(result[0]?.getParentId()).toBeNull();
        expect(result[1]?.getId()).toBe(2);
        expect(result[1]?.getParentId()).toBe(1);
    });

    it('пустой справочник — пустой список, не ошибка', async () => {
        const { repository, findMany } = buildRepository();
        findMany.mockResolvedValueOnce([]);

        const result = await repository.findAll();

        expect(result).toEqual([]);
    });
});
