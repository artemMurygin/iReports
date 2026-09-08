import { MoySkladSyncService } from './moysklad-sync.service';
import { DemandSchema } from '../../integrations/moySklad/schemas/demands.schema';
import { PURCHASER_ATTRIBUTE_NAME } from './moysklad-sync.mappers';
import type { MoyskladService } from '../../integrations/moySklad/moysklad.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// randomUUID мокается детерминированным значением — тесты D5/D5.1 ниже
// проверяют конкретное значение id, которое сервис подставляет на create.
jest.mock('crypto', () => ({ randomUUID: () => 'generated-uuid' }));

// Голый MetaSchema ({ href, type, mediaType }) — используется там, где поле
// само по себе является meta-объектом (Demand.meta, positions.meta,
// row.meta, attribute.meta, assortment.meta).
const meta = (
    type: string,
    href = `https://api.moysklad.ru/api/remap/1.2/entity/${type}/fixture`,
) => ({ href, type, mediaType: 'application/json' });

// MetaWrapperSchema ({ meta: {...} }) — используется там, где поле —
// ссылка на другую сущность (agent, organization, rate.currency, owner).
const metaWrapper = (type: string, href?: string) => ({
    meta: meta(type, href),
});

// issue #48/#49/#51 (Фаза 10): синк отгрузок должен сохранять доп. поля
// закупщиков БУ техники на уровне позиции — у каждой позиции свой
// закупщик, в одной отгрузке могут быть разные (см.
// docs/payroll/prd-payroll-calculation.md, раздел "Роли магазина").
function buildDemandFixture() {
    return DemandSchema.parse({
        accountId: 'acc-1',
        agent: metaWrapper('counterparty'),
        applicable: true,
        created: '2026-01-05 10:00:00',
        externalCode: 'ext-demand-1',
        id: 'demand-1',
        meta: meta('demand'),
        moment: '2026-01-05 10:00:00',
        name: '0001',
        organization: metaWrapper('organization'),
        owner: metaWrapper(
            'employee',
            'https://api.moysklad.ru/api/remap/1.2/entity/employee/offline-manager-1',
        ),
        payedSum: 500000,
        positions: {
            meta: meta('positions'),
            rows: [
                {
                    meta: meta('demandposition'),
                    id: 'position-1',
                    accountId: 'acc-pos-1',
                    quantity: 1,
                    price: 300000,
                    discount: 0,
                    vat: 0,
                    vatEnabled: false,
                    attributes: [
                        {
                            meta: meta('attributemetadata'),
                            id: 'attr-online-purchaser',
                            name: PURCHASER_ATTRIBUTE_NAME.ONLINE,
                            type: 'employee',
                            value: metaWrapper(
                                'employee',
                                'https://api.moysklad.ru/api/remap/1.2/entity/employee/purchaser-employee-1',
                            ),
                        },
                    ],
                    assortment: {
                        meta: meta('product'),
                        id: 'product-1',
                        name: 'iPhone 12 (БУ)',
                    },
                    stock: {
                        cost: 200000,
                        quantity: 1,
                        reserve: 0,
                        intransit: 0,
                        available: 1,
                    },
                },
                {
                    meta: meta('demandposition'),
                    id: 'position-2',
                    accountId: 'acc-pos-2',
                    quantity: 1,
                    price: 200000,
                    discount: 0,
                    vat: 0,
                    vatEnabled: false,
                    attributes: [
                        {
                            meta: meta('attributemetadata'),
                            id: 'attr-online-purchaser',
                            name: PURCHASER_ATTRIBUTE_NAME.ONLINE,
                            type: 'string',
                            value: 'Петров П.П.',
                        },
                    ],
                    assortment: {
                        meta: meta('product'),
                        id: 'product-2',
                        name: 'iPhone 13 (БУ)',
                    },
                    stock: {
                        cost: 100000,
                        quantity: 1,
                        reserve: 0,
                        intransit: 0,
                        available: 1,
                    },
                },
            ],
        },
        printed: false,
        published: false,
        rate: { currency: metaWrapper('currency') },
        shared: false,
        sum: 500000,
        updated: '2026-01-05 10:00:00',
    });
}

// spec: shop-turnover-report D2 — справочник складов синкается тем же
// способом, что и остальные простые справочники (employees/productFolders):
// упрощённый апсерт по постраничной выгрузке MoyskladService.
describe('MoySkladSyncService.uploadStores (D2)', () => {
    const buildService = () => {
        const upsert = jest.fn().mockResolvedValue({});
        const db = {
            moySkladStore: { upsert },
        } as unknown as DatabaseService;
        const moySklad = {
            fetchStores: jest.fn(function* () {
                yield [
                    { id: 'store-1', name: 'Склад на Тверской' },
                    { id: 'store-2', name: 'Склад на Ленинском' },
                ];
            }),
        } as unknown as MoyskladService;

        const service = new MoySkladSyncService(db, moySklad);
        return { service, upsert };
    };

    it('апсертит каждый склад из ответа МойСклад по id', async () => {
        const { service, upsert } = buildService();

        await service.uploadStores();

        expect(upsert).toHaveBeenCalledTimes(2);
        expect(upsert).toHaveBeenCalledWith({
            where: { id: 'store-1' },
            create: { id: 'store-1', name: 'Склад на Тверской' },
            update: { name: 'Склад на Тверской' },
        });
        expect(upsert).toHaveBeenCalledWith({
            where: { id: 'store-2' },
            create: { id: 'store-2', name: 'Склад на Ленинском' },
            update: { name: 'Склад на Ленинском' },
        });
    });
});

describe('MoySkladSyncService.uploadDemand (Фаза 10)', () => {
    const buildService = () => {
        const createManyPositions = jest.fn().mockResolvedValue({ count: 2 });
        const tx = {
            moySkladDemand: { upsert: jest.fn().mockResolvedValue({}) },
            moySkladDemandPosition: {
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                createMany: createManyPositions,
            },
            moySkladProduct: {
                // Оба товара позиций уже существуют — ветка "докатки"
                // отсутствующих товаров/вариантов в этом тесте не участвует.
                findMany: jest
                    .fn()
                    .mockResolvedValue([
                        { id: 'product-1' },
                        { id: 'product-2' },
                    ]),
                createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            moySkladService: {
                findMany: jest.fn().mockResolvedValue([]),
                createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
        };
        const db = {
            $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
                Promise.resolve(cb(tx)),
            ),
        } as unknown as DatabaseService;
        const moySklad = {} as unknown as MoyskladService;

        const service = new MoySkladSyncService(db, moySklad);
        return { service, tx, createManyPositions };
    };

    it('сохраняет доп. поля закупщика для каждой позиции отдельно (employee и string варианты значения)', async () => {
        const { service, createManyPositions } = buildService();
        const demand = buildDemandFixture();

        // uploadDemand приватный — тестируем через тот же путь, что и
        // публичный uploadCreatedDemands/uploadUpdatedDemands.
        await (
            service as unknown as {
                uploadDemand: (d: typeof demand) => Promise<void>;
            }
        ).uploadDemand(demand);

        expect(createManyPositions).toHaveBeenCalledTimes(1);
        const call = createManyPositions.mock.calls[0] as [{ data: unknown }];
        const rows = call[0].data as Array<{
            id: string;
            onlinePurchaserId: string | null;
            offlinePurchaserId: string | null;
        }>;

        const position1 = rows.find((r) => r.id === 'position-1');
        const position2 = rows.find((r) => r.id === 'position-2');

        // employee-тип атрибута — id сотрудника МойСклад извлечён из href.
        expect(position1?.onlinePurchaserId).toBe('purchaser-employee-1');
        expect(position1?.offlinePurchaserId).toBeNull();

        // string-тип атрибута — голое строковое значение как есть.
        expect(position2?.onlinePurchaserId).toBe('Петров П.П.');
        expect(position2?.offlinePurchaserId).toBeNull();

        // Разные закупщики в одной отгрузке — не задваиваются и не путаются.
        expect(position1?.onlinePurchaserId).not.toBe(
            position2?.onlinePurchaserId,
        );
    });

    // spec: shop-turnover-report D3 — storeId уже приходит в ответе МойСклад
    // (demand.store), но раньше отбрасывался при апсерте.
    it('сохраняет storeId, когда МойСклад отдаёт demand.store', async () => {
        const { service, tx } = buildService();
        const demand = buildDemandFixture();
        demand.store = {
            meta: {
                href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-1',
                type: 'store',
                mediaType: 'application/json',
            },
        };

        await (
            service as unknown as {
                uploadDemand: (d: typeof demand) => Promise<void>;
            }
        ).uploadDemand(demand);

        const upsertCall = tx.moySkladDemand.upsert.mock.calls[0] as [
            {
                create: { storeId: string | null };
                update: { storeId: string | null };
            },
        ];
        expect(upsertCall[0].create.storeId).toBe('store-1');
        expect(upsertCall[0].update.storeId).toBe('store-1');
    });

    it('оставляет storeId = null, когда МойСклад не отдаёт demand.store, апсерт не падает', async () => {
        const { service, tx } = buildService();
        const demand = buildDemandFixture();
        // buildDemandFixture не задаёт store — поле nullable/optional.

        await expect(
            (
                service as unknown as {
                    uploadDemand: (d: typeof demand) => Promise<void>;
                }
            ).uploadDemand(demand),
        ).resolves.not.toThrow();

        const upsertCall = tx.moySkladDemand.upsert.mock.calls[0] as [
            {
                create: { storeId: string | null };
                update: { storeId: string | null };
            },
        ];
        expect(upsertCall[0].create.storeId).toBeNull();
        expect(upsertCall[0].update.storeId).toBeNull();
    });
});

// spec: shop-turnover-report D5/D7.1 — почасовой снимок остатков в
// накопительную (append-only) таблицу MoySkladStock. Каждый прогон должен
// писать НОВЫЙ набор строк с ОБЩИМ snapshotAt, не трогая строки предыдущих
// прогонов (нет ни deleteMany, ни upsert по фиксированному ключу — только
// createMany новых строк).
describe('MoySkladSyncService.uploadStockSnapshot (D5)', () => {
    const buildService = () => {
        const createMany = jest.fn().mockResolvedValue({ count: 0 });
        const db = {
            moySkladStock: { createMany },
        } as unknown as DatabaseService;
        const moySklad = {
            fetchStockByStore: jest.fn(function* () {
                yield [
                    {
                        meta: {
                            href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                        },
                        stockByStore: [
                            {
                                meta: {
                                    href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-1',
                                },
                                stock: 5,
                                price: 12345,
                            },
                            {
                                meta: {
                                    href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-2',
                                },
                                stock: 0,
                                price: 0,
                            },
                        ],
                    },
                ];
                yield [
                    {
                        meta: {
                            href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-2',
                        },
                        stockByStore: [
                            {
                                meta: {
                                    href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-1',
                                },
                                stock: 2,
                                price: 500,
                            },
                        ],
                    },
                ];
            }),
        } as unknown as MoyskladService;

        const service = new MoySkladSyncService(db, moySklad);
        return { service, createMany };
    };

    it('пишет новый набор строк с общим snapshotAt для всех строк одного прогона', async () => {
        const { service, createMany } = buildService();

        await service.uploadStockSnapshot();

        expect(createMany).toHaveBeenCalledTimes(2);
        type Row = {
            id: string;
            productId: string;
            warehouseId: string;
            quantity: number;
            costSum: number;
            snapshotAt: Date;
        };
        const allRows = createMany.mock.calls.flatMap(
            (call: unknown[]) => (call[0] as { data: Row[] }).data,
        );
        expect(allRows).toHaveLength(3);

        const snapshotTimes = new Set(
            allRows.map((r) => r.snapshotAt.getTime()),
        );
        expect(snapshotTimes.size).toBe(1);

        const row1 = allRows.find(
            (r) => r.productId === 'product-1' && r.warehouseId === 'store-1',
        );
        expect(row1).toMatchObject({
            id: 'generated-uuid',
            quantity: 5,
            costSum: 12345,
        });

        const row2 = allRows.find(
            (r) => r.productId === 'product-2' && r.warehouseId === 'store-1',
        );
        expect(row2).toMatchObject({ quantity: 2, costSum: 500 });
    });
});

// spec: shop-turnover-report D5.1 — разовый бэкфилл истории остатков через
// легаси GET /entity/assortment: по одному снимку на конец каждого месяца
// от fromDate до текущего, для каждого уже засинканного склада;
// идемпотентен — повторный запуск с тем же диапазоном апсертит по тому же
// ключу (productId, warehouseId, snapshotAt), не создаёт дублей.
describe('MoySkladSyncService.backfillHistoricalStockSnapshots (D5.1)', () => {
    const buildService = () => {
        const findMany = jest
            .fn()
            .mockResolvedValue([{ id: 'store-1' }, { id: 'store-2' }]);
        const upsert = jest.fn().mockResolvedValue({});
        const db = {
            moySkladStore: { findMany },
            moySkladStock: { upsert },
        } as unknown as DatabaseService;
        const fetchAssortmentStockAt = jest.fn(function* (
            _momentEnd: Date,
            storeId: string,
        ) {
            yield [
                {
                    productHref: `https://api.moysklad.ru/api/remap/1.2/entity/product/product-${storeId}`,
                    quantity: 3,
                    costSum: 999,
                },
            ];
        });
        const moySklad = {
            fetchAssortmentStockAt,
        } as unknown as MoyskladService;

        const service = new MoySkladSyncService(db, moySklad);
        return { service, findMany, upsert, fetchAssortmentStockAt };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('пишет один снимок на конец каждого месяца от fromDate до текущего, для каждого склада', async () => {
        const { service, fetchAssortmentStockAt, upsert } = buildService();
        const fromDate = new Date('2026-07-01T00:00:00.000Z');

        await service.backfillHistoricalStockSnapshots(fromDate);

        // Июль, август, сентябрь 2026 (текущий месяц захвачен фейковым
        // временем выше) × 2 склада.
        expect(fetchAssortmentStockAt).toHaveBeenCalledTimes(6);

        const julyEnd = new Date('2026-07-31T23:59:59.999Z');
        const septemberEnd = new Date('2026-09-30T23:59:59.999Z');
        expect(fetchAssortmentStockAt).toHaveBeenCalledWith(julyEnd, 'store-1');
        expect(fetchAssortmentStockAt).toHaveBeenCalledWith(
            septemberEnd,
            'store-2',
        );

        expect(upsert).toHaveBeenCalledTimes(6);
        expect(upsert).toHaveBeenCalledWith({
            where: {
                productId_warehouseId_snapshotAt: {
                    productId: 'product-store-1',
                    warehouseId: 'store-1',
                    snapshotAt: septemberEnd,
                },
            },
            create: {
                id: 'generated-uuid',
                productId: 'product-store-1',
                warehouseId: 'store-1',
                quantity: 3,
                costSum: 999,
                snapshotAt: septemberEnd,
            },
            update: { quantity: 3, costSum: 999 },
        });
    });

    it('идемпотентен: повторный запуск с тем же диапазоном апсертит по тем же ключам, не дублирует', async () => {
        const { service, upsert } = buildService();
        const fromDate = new Date('2026-09-01T00:00:00.000Z');

        await service.backfillHistoricalStockSnapshots(fromDate);
        const firstKeys = upsert.mock.calls.map(
            (call: unknown[]) => (call[0] as { where: unknown }).where,
        );
        upsert.mockClear();

        await service.backfillHistoricalStockSnapshots(fromDate);
        const secondKeys = upsert.mock.calls.map(
            (call: unknown[]) => (call[0] as { where: unknown }).where,
        );

        expect(secondKeys).toEqual(firstKeys);
    });
});
