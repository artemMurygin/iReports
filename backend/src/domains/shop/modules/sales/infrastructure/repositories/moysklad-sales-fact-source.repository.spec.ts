import { MoySkladSalesFactSourceRepository } from './moysklad-sales-fact-source.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import type { ProductFolderTreeService } from '@/domains/shop/sync/moySklad/product-folder-tree.service';

// Фаза 1 (docs/shop-sales-performance-by-category): раскрытие категории
// через ProductFolderTreeService при агрегации факта продаж shop. Тот же
// приём мока DatabaseService, что и в product-folder-tree.service.spec.ts —
// PrismaRepository.client делегирует в db.getClient(), поэтому фейковому
// db достаточно реализовать только этот метод, без реального
// RequestContext/AsyncLocalStorage. Отдел захардкожен в репозитории как
// SHOP_DEPARTMENT_ID (см. комментарий там же), поэтому здесь department не
// варьируется между кейсами.
describe('MoySkladSalesFactSourceRepository.aggregate', () => {
    interface PositionRow {
        sum: number;
        cost: number;
        profit: number;
        quantity: number;
        product: { folderId: string } | null;
        service: { folderId: string } | null;
    }

    const buildRepository = (
        positions: PositionRow[],
        descendantsByRoot: Record<string, string[]>,
    ) => {
        const findMany = jest.fn().mockResolvedValue(positions);
        const db = {
            getClient: () => ({
                moySkladDemandPosition: { findMany },
            }),
        } as unknown as DatabaseService;

        const resolveDescendantFolderIds = jest.fn(
            (rootId: string): Promise<string[]> =>
                Promise.resolve(descendantsByRoot[rootId] ?? []),
        );
        const folderTree = {
            resolveDescendantFolderIds,
        } as unknown as ProductFolderTreeService;

        const repository = new MoySkladSalesFactSourceRepository(
            db,
            folderTree,
        );
        return { repository, findMany, resolveDescendantFolderIds };
    };

    const productPosition = (
        folderId: string,
        overrides: Partial<Omit<PositionRow, 'product' | 'service'>> = {},
    ): PositionRow => ({
        sum: 1000,
        cost: 600,
        profit: 300,
        quantity: 1,
        product: { folderId },
        service: null,
        ...overrides,
    });

    it('факт по категории учитывает продажи из вложенной (дочерней) папки', async () => {
        // Дерево: root -> child. Позиция продана из child, план — по root.
        const { repository } = buildRepository(
            [
                productPosition('folder-child', {
                    sum: 5_000,
                    profit: 1_500,
                    cost: 3_000,
                    quantity: 2,
                }),
            ],
            { 'folder-root': ['folder-root', 'folder-child'] },
        );

        const buckets = await repository.aggregate('2026-08', ['folder-root']);

        expect(buckets).toHaveLength(1);
        expect(buckets[0]).toMatchObject({
            department: 160,
            category: 'folder-root',
            turnover: 5_000,
            margin: 1_500,
            cost: 3_000,
            quantity: 2,
        });
    });

    it('план без category (categoryIds не содержит соответствующей папки) — поведение не меняется: факт агрегируется в бакет с category: null', async () => {
        const { repository, resolveDescendantFolderIds } = buildRepository(
            [
                productPosition('folder-unrelated', {
                    sum: 7_000,
                    profit: 2_100,
                    cost: 4_200,
                    quantity: 3,
                }),
            ],
            {},
        );

        const buckets = await repository.aggregate('2026-08', []);

        expect(resolveDescendantFolderIds).not.toHaveBeenCalled();
        expect(buckets).toHaveLength(1);
        expect(buckets[0]).toMatchObject({
            department: 160,
            category: null,
            turnover: 7_000,
            margin: 2_100,
            cost: 4_200,
            quantity: 3,
        });
    });

    it('продажи двух разных категорий одного отдела разносятся по отдельным бакетам, не смешиваясь', async () => {
        const { repository } = buildRepository(
            [
                productPosition('folder-a', {
                    sum: 1_000,
                    profit: 300,
                    cost: 600,
                    quantity: 1,
                }),
                productPosition('folder-a', {
                    sum: 500,
                    profit: 150,
                    cost: 300,
                    quantity: 1,
                }),
                productPosition('folder-b', {
                    sum: 9_000,
                    profit: 2_700,
                    cost: 5_400,
                    quantity: 4,
                }),
            ],
            {
                'category-a': ['category-a', 'folder-a'],
                'category-b': ['category-b', 'folder-b'],
            },
        );

        const buckets = await repository.aggregate('2026-08', [
            'category-a',
            'category-b',
        ]);

        expect(buckets).toHaveLength(2);

        const bucketA = buckets.find((b) => b.category === 'category-a');
        const bucketB = buckets.find((b) => b.category === 'category-b');

        expect(bucketA).toMatchObject({
            department: 160,
            turnover: 1_500, // 1_000 + 500, не задето продажами category-b
            margin: 450,
            cost: 900,
            quantity: 2,
        });
        expect(bucketB).toMatchObject({
            department: 160,
            turnover: 9_000,
            margin: 2_700,
            cost: 5_400,
            quantity: 4,
        });
    });

    it('позиция услуги (service.folderId) классифицируется так же, как позиция товара', async () => {
        const { repository } = buildRepository(
            [
                {
                    sum: 2_000,
                    cost: 800,
                    profit: 1_200,
                    quantity: 1,
                    product: null,
                    service: { folderId: 'folder-service' },
                },
            ],
            { 'folder-service': ['folder-service'] },
        );

        const buckets = await repository.aggregate('2026-08', [
            'folder-service',
        ]);

        expect(buckets).toHaveLength(1);
        expect(buckets[0]).toMatchObject({
            category: 'folder-service',
            turnover: 2_000,
        });
    });

    it('план на родительскую и вложенную дочернюю категорию одновременно — позиция дочерней категории засчитывается в дочернюю, а не в родительскую, независимо от порядка categoryIds', async () => {
        // Дерево: parent -> child -> leaf. Планы заведены и на parent, и на
        // child. Позиция продана из leaf — должна попасть в child (самую
        // специфичную из запрошенных категорий, которой принадлежит leaf),
        // а не в parent.
        const descendants = {
            parent: ['parent', 'child', 'leaf', 'other-child'],
            child: ['child', 'leaf'],
        };

        const forOrder = async (categoryIds: string[]) => {
            const { repository } = buildRepository(
                [
                    productPosition('leaf', {
                        sum: 4_000,
                        profit: 1_200,
                        cost: 2_400,
                        quantity: 1,
                    }),
                ],
                descendants,
            );
            return repository.aggregate('2026-08', categoryIds);
        };

        for (const categoryIds of [
            ['parent', 'child'],
            ['child', 'parent'],
        ]) {
            const buckets = await forOrder(categoryIds);
            expect(buckets).toHaveLength(1);
            expect(buckets[0]).toMatchObject({
                category: 'child',
                turnover: 4_000,
            });
        }
    });
});
