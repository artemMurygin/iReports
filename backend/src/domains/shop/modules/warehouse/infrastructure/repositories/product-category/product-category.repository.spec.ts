import { ProductCategoryRepository } from './product-category.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// add-department-head-salary-rules, tasks.md задача 5.3, FR5: findRootIds() читает только id
// категорий с parentId IS NULL — не дерево целиком (по образцу GetCatalogService).
describe('ProductCategoryRepository.findRootIds', () => {
    it('возвращает Set из id категорий, найденных Prisma-запросом с parentId: null', async () => {
        const findMany = jest
            .fn()
            .mockResolvedValue([{ id: 'root-1' }, { id: 'root-2' }]);
        const db = {
            moySkladProductFolder: { findMany },
        } as unknown as DatabaseService;
        const repository = new ProductCategoryRepository(db);

        const result = await repository.findRootIds();

        expect(findMany).toHaveBeenCalledWith({
            where: { parentId: null },
            select: { id: true },
        });
        expect(result).toEqual(new Set(['root-1', 'root-2']));
    });

    it('пустой справочник -> пустой Set', async () => {
        const findMany = jest.fn().mockResolvedValue([]);
        const db = {
            moySkladProductFolder: { findMany },
        } as unknown as DatabaseService;
        const repository = new ProductCategoryRepository(db);

        const result = await repository.findRootIds();

        expect(result).toEqual(new Set());
    });
});
