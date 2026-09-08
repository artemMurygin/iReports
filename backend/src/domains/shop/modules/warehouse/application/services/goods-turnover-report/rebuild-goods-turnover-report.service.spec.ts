import { RebuildGoodsTurnoverReportService } from './rebuild-goods-turnover-report.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import type { ProductFolderTreeService } from '@/domains/shop/sync/moySklad/product-folder-tree.service';
import type { GoodsTurnoverReportRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import { Period } from '@/shared/domain/period.value-object';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';

interface PositionRow {
    quantity: number;
    sum: number;
    product: { folderId: string | null } | null;
    demand: { storeId: string | null };
}

interface StockRow {
    productId: string;
    warehouseId: string;
    quantity: number;
    costSum: number;
}

interface ProductRow {
    id: string;
    folderId: string | null;
}

interface FolderRow {
    id: string;
}

// Обход дерева переиспользует ProductFolderTreeService.resolveDescendantFolderIds
// (см. architecture.md) — фейк описывает дерево через явную карту
// "folderId -> [сам себя, ...потомки]", по тому же приёму, что и
// moysklad-sales-fact-source.repository.spec.ts.
function buildService(options: {
    folders?: FolderRow[];
    positions?: PositionRow[];
    stockMaxSnapshotAt?: Date | null;
    stockRows?: StockRow[];
    products?: ProductRow[];
    descendantsByRoot?: Record<string, string[]>;
}) {
    const {
        folders = [],
        positions = [],
        stockMaxSnapshotAt = null,
        stockRows = [],
        products = [],
        descendantsByRoot = {},
    } = options;

    const findManyPositions = jest.fn().mockResolvedValue(positions);
    const findManyFolders = jest.fn().mockResolvedValue(folders);
    const aggregateStock = jest
        .fn()
        .mockResolvedValue({ _max: { snapshotAt: stockMaxSnapshotAt } });
    const findManyStock = jest.fn().mockResolvedValue(stockRows);
    const findManyProducts = jest.fn().mockResolvedValue(products);

    const db = {
        moySkladDemandPosition: { findMany: findManyPositions },
        moySkladProductFolder: { findMany: findManyFolders },
        moySkladStock: { aggregate: aggregateStock, findMany: findManyStock },
        moySkladProduct: { findMany: findManyProducts },
    } as unknown as DatabaseService;

    const resolveDescendantFolderIds = jest.fn((rootId: string) =>
        Promise.resolve(descendantsByRoot[rootId] ?? [rootId]),
    );
    const folderTree = {
        resolveDescendantFolderIds,
    } as unknown as ProductFolderTreeService;

    const replaceForPeriod = jest.fn().mockResolvedValue(undefined);
    const findByPeriod = jest.fn().mockResolvedValue([]);
    const repository: GoodsTurnoverReportRepositoryPort = {
        replaceForPeriod,
        findByPeriod,
    };

    const service = new RebuildGoodsTurnoverReportService(
        db,
        folderTree,
        repository,
    );

    return {
        service,
        replaceForPeriod,
        findManyPositions,
        findManyStock,
        aggregateStock,
    };
}

function linesByCategoryWarehouse(
    lines: GoodsTurnoverReportLine[],
): Record<string, GoodsTurnoverReportLine> {
    const map: Record<string, GoodsTurnoverReportLine> = {};
    for (const line of lines) {
        map[`${line.categoryId}:${line.warehouseId}`] = line;
    }
    return map;
}

describe('RebuildGoodsTurnoverReportService.rebuild', () => {
    it('оборот считается только по MoySkladDemandPosition.sum (₽ -> коп.) внутри границ периода, без учёта позиций без товара/склада', async () => {
        const { service, replaceForPeriod } = buildService({
            folders: [{ id: 'folder-a' }],
            positions: [
                {
                    quantity: 2,
                    sum: 1000, // рубли
                    product: { folderId: 'folder-a' },
                    demand: { storeId: 'store-1' },
                },
                // без товара (услуга) — не должна попасть в оборот
                {
                    quantity: 1,
                    sum: 500,
                    product: null,
                    demand: { storeId: 'store-1' },
                },
            ],
        });

        await service.rebuild(Period.create('2026-08'));

        const [, lines] = replaceForPeriod.mock.calls[0] as [
            Period,
            GoodsTurnoverReportLine[],
        ];
        const byKey = linesByCategoryWarehouse(lines);
        const line = byKey['folder-a:store-1'];
        expect(line).toBeDefined();
        expect(line.turnoverQuantity).toBe(2);
        expect(line.turnoverSum.getValue()).toBe(100_000); // 1000 руб -> 100000 коп
    });

    it('фильтрует позиции демандами вне границ периода', async () => {
        const findManyPositions = jest.fn().mockResolvedValue([]);
        const db = {
            moySkladDemandPosition: { findMany: findManyPositions },
            moySkladProductFolder: {
                findMany: jest.fn().mockResolvedValue([]),
            },
            moySkladStock: {
                aggregate: jest
                    .fn()
                    .mockResolvedValue({ _max: { snapshotAt: null } }),
                findMany: jest.fn().mockResolvedValue([]),
            },
            moySkladProduct: { findMany: jest.fn().mockResolvedValue([]) },
        } as unknown as DatabaseService;
        const folderTree = {
            resolveDescendantFolderIds: jest.fn().mockResolvedValue([]),
        } as unknown as ProductFolderTreeService;
        const repository: GoodsTurnoverReportRepositoryPort = {
            replaceForPeriod: jest.fn().mockResolvedValue(undefined),
            findByPeriod: jest.fn().mockResolvedValue([]),
        };
        const service = new RebuildGoodsTurnoverReportService(
            db,
            folderTree,
            repository,
        );

        await service.rebuild(Period.create('2026-08'));

        const [call] = findManyPositions.mock.calls[0] as [
            { where: { demand: { moment: { gte: Date; lte: Date } } } },
        ];
        expect(call.where.demand.moment.gte.toISOString()).toBe(
            '2026-08-01T00:00:00.000Z',
        );
        expect(call.where.demand.moment.lte.toISOString()).toBe(
            '2026-08-31T23:59:59.999Z',
        );
    });

    it('остаток берётся из снимка MoySkladStock с максимальным snapshotAt, не превышающим конец периода', async () => {
        const { service, aggregateStock, findManyStock } = buildService({
            folders: [{ id: 'folder-a' }],
            stockMaxSnapshotAt: new Date('2026-07-31T23:59:59.999Z'),
            stockRows: [
                {
                    productId: 'product-1',
                    warehouseId: 'store-1',
                    quantity: 5,
                    costSum: 12_345,
                },
            ],
            products: [{ id: 'product-1', folderId: 'folder-a' }],
        });

        await service.rebuild(Period.create('2026-07'));

        expect(aggregateStock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    snapshotAt: {
                        lte: new Date('2026-07-31T23:59:59.999Z'),
                    },
                },
            }),
        );
        expect(findManyStock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { snapshotAt: new Date('2026-07-31T23:59:59.999Z') },
            }),
        );
    });

    it('каждая категория дерева (включая вложенные) присутствует в результате, с нулями при отсутствии оборота/остатка', async () => {
        const { service, replaceForPeriod } = buildService({
            folders: [{ id: 'folder-root' }, { id: 'folder-child' }],
            positions: [
                {
                    quantity: 1,
                    sum: 100,
                    product: { folderId: 'folder-child' },
                    demand: { storeId: 'store-1' },
                },
            ],
            descendantsByRoot: {
                'folder-root': ['folder-root', 'folder-child'],
                'folder-child': ['folder-child'],
            },
        });

        await service.rebuild(Period.create('2026-08'));

        const [, lines] = replaceForPeriod.mock.calls[0] as [
            Period,
            GoodsTurnoverReportLine[],
        ];
        const byKey = linesByCategoryWarehouse(lines);

        // Родитель включает оборот потомка (рулап).
        expect(byKey['folder-root:store-1'].turnoverQuantity).toBe(1);
        expect(byKey['folder-root:store-1'].turnoverSum.getValue()).toBe(
            10_000,
        );
        // Потомок присутствует сам по себе тоже.
        expect(byKey['folder-child:store-1'].turnoverQuantity).toBe(1);
    });

    it('категория без единого движения по всем известным складам всё равно присутствует с нулями', async () => {
        const { service, replaceForPeriod } = buildService({
            folders: [{ id: 'folder-empty' }, { id: 'folder-with-data' }],
            positions: [
                {
                    quantity: 1,
                    sum: 100,
                    product: { folderId: 'folder-with-data' },
                    demand: { storeId: 'store-1' },
                },
            ],
        });

        await service.rebuild(Period.create('2026-08'));

        const [, lines] = replaceForPeriod.mock.calls[0] as [
            Period,
            GoodsTurnoverReportLine[],
        ];
        const byKey = linesByCategoryWarehouse(lines);
        const emptyLine = byKey['folder-empty:store-1'];
        expect(emptyLine).toBeDefined();
        expect(emptyLine.turnoverQuantity).toBe(0);
        expect(emptyLine.turnoverSum.getValue()).toBe(0);
        expect(emptyLine.stockQuantity).toBe(0);
        expect(emptyLine.stockSum.getValue()).toBe(0);
    });

    it('результат разбит по складам отдельными строками, без объединения', async () => {
        const { service, replaceForPeriod } = buildService({
            folders: [{ id: 'folder-a' }],
            positions: [
                {
                    quantity: 1,
                    sum: 100,
                    product: { folderId: 'folder-a' },
                    demand: { storeId: 'store-1' },
                },
                {
                    quantity: 3,
                    sum: 300,
                    product: { folderId: 'folder-a' },
                    demand: { storeId: 'store-2' },
                },
            ],
        });

        await service.rebuild(Period.create('2026-08'));

        const [, lines] = replaceForPeriod.mock.calls[0] as [
            Period,
            GoodsTurnoverReportLine[],
        ];
        const byKey = linesByCategoryWarehouse(lines);
        expect(byKey['folder-a:store-1'].turnoverQuantity).toBe(1);
        expect(byKey['folder-a:store-2'].turnoverQuantity).toBe(3);
        expect(lines).toHaveLength(2);
    });

    it('повторный вызов для того же периода полностью заменяет прежние строки (передаёт полный свежий набор в replaceForPeriod, а не дельту)', async () => {
        const { service, replaceForPeriod } = buildService({
            folders: [{ id: 'folder-a' }],
            positions: [
                {
                    quantity: 1,
                    sum: 100,
                    product: { folderId: 'folder-a' },
                    demand: { storeId: 'store-1' },
                },
            ],
        });
        const period = Period.create('2026-08');

        await service.rebuild(period);
        await service.rebuild(period);

        expect(replaceForPeriod).toHaveBeenCalledTimes(2);
        const [, firstLines] = replaceForPeriod.mock.calls[0] as [
            unknown,
            GoodsTurnoverReportLine[],
        ];
        const [, secondLines] = replaceForPeriod.mock.calls[1] as [
            unknown,
            GoodsTurnoverReportLine[],
        ];
        expect(secondLines).toHaveLength(firstLines.length);
        expect(replaceForPeriod).toHaveBeenNthCalledWith(
            1,
            period,
            expect.any(Array),
        );
        expect(replaceForPeriod).toHaveBeenNthCalledWith(
            2,
            period,
            expect.any(Array),
        );
    });
});
