import { Logger } from '@nestjs/common';
import {
    MoySkladSyncService,
    HISTORICAL_TURNOVER_LOOKBACK_ANCHOR,
} from './moysklad-sync.service';
import { DemandSchema } from '../../integrations/moySklad/schemas/demands.schema';
import { ProductSchema } from '../../integrations/moySklad/schemas/products.schema';
import { PURCHASER_ATTRIBUTE_NAME } from './moysklad-sync.mappers';
import type { MoyskladService } from '../../integrations/moySklad/moysklad.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// randomUUID мокается детерминированным значением — тесты D5/D5.1 ниже
// проверяют конкретное значение id, которое сервис подставляет на create.
jest.mock('crypto', () => ({ randomUUID: () => 'generated-uuid' }));

// delay() мокается на весь файл (тот же паттерн, что moysklad.service.spec.ts) —
// троттлинг между вызовами fetchTurnoverByStoreForProduct в
// backfillHistoricalStockSnapshots не должен реально ждать в тестах.
jest.mock('../../../../shared/delay', () => ({
    delay: jest.fn().mockResolvedValue(undefined),
}));

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

// Закупщик БУ техники — доп. поле КАРТОЧКИ ТОВАРА, а не позиции отгрузки
// (см. комментарий над MoySkladProduct.onlinePurchaserId в moySklad.prisma:
// изначальное предположение "уровень позиции" не подтвердилось — МойСклад
// не поддерживает кастомные атрибуты на строке позиции документа).
describe('MoySkladSyncService.uploadProducts', () => {
    const buildService = () => {
        const upsert = jest.fn().mockResolvedValue({});
        const db = {
            moySkladProduct: { upsert },
        } as unknown as DatabaseService;
        const moySklad = {
            fetchProducts: jest.fn(function* () {
                yield [
                    ProductSchema.parse({
                        id: 'product-1',
                        name: 'iPhone 12 (БУ)',
                        externalCode: 'ext-1',
                        updated: '2026-08-05 10:00:00',
                        archived: false,
                        attributes: [
                            {
                                meta: {
                                    href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1/attributes/attr-online-purchaser',
                                    type: 'attributemetadata',
                                    mediaType: 'application/json',
                                },
                                id: 'attr-online-purchaser',
                                name: PURCHASER_ATTRIBUTE_NAME.ONLINE,
                                type: 'employee',
                                value: {
                                    meta: {
                                        href: 'https://api.moysklad.ru/api/remap/1.2/entity/employee/purchaser-employee-1',
                                        type: 'employee',
                                        mediaType: 'application/json',
                                    },
                                },
                            },
                        ],
                    }),
                    ProductSchema.parse({
                        id: 'product-2',
                        name: 'iPhone 13 (БУ)',
                        externalCode: 'ext-2',
                        updated: '2026-08-05 10:00:00',
                        archived: false,
                        attributes: [
                            {
                                meta: {
                                    href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-2/attributes/attr-offline-purchaser',
                                    type: 'attributemetadata',
                                    mediaType: 'application/json',
                                },
                                id: 'attr-offline-purchaser',
                                name: PURCHASER_ATTRIBUTE_NAME.OFFLINE,
                                type: 'string',
                                value: 'Петров П.П.',
                            },
                        ],
                    }),
                ];
            }),
        } as unknown as MoyskladService;

        const service = new MoySkladSyncService(db, moySklad);
        return { service, upsert };
    };

    it('резолвит закупщика из доп. поля товара (employee и string варианты значения)', async () => {
        const { service, upsert } = buildService();

        await service.uploadProducts();

        expect(upsert).toHaveBeenCalledTimes(2);

        const calls = upsert.mock.calls as unknown as Array<
            [{ where: { id: string }; create: Record<string, unknown> }]
        >;
        const call1 = calls.find((c) => c[0].where.id === 'product-1')![0];
        const call2 = calls.find((c) => c[0].where.id === 'product-2')![0];

        // employee-тип атрибута — id сотрудника МойСклад извлечён из href.
        expect(call1.create.onlinePurchaserId).toBe('purchaser-employee-1');
        expect(call1.create.offlinePurchaserId).toBeNull();

        // string-тип атрибута — голое строковое значение как есть.
        expect(call2.create.offlinePurchaserId).toBe('Петров П.П.');
        expect(call2.create.onlinePurchaserId).toBeNull();
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

    // Закупщик БУ техники больше не резолвится на уровне позиции (см.
    // MoySkladSyncService.uploadProducts ниже) — позиция несёт только
    // привязку к товару/сумму/себестоимость.
    it('сохраняет позиции отгрузки с привязкой к товару', async () => {
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
            productId: string | null;
            sum: number;
        }>;

        const position1 = rows.find((r) => r.id === 'position-1');
        const position2 = rows.find((r) => r.id === 'position-2');

        expect(position1?.productId).toBe('product-1');
        expect(position2?.productId).toBe('product-2');
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

// spec: fix-shop-turnover-historical-stock-cost D1/D4 — разовый бэкфилл
// истории остатков через связку /report/turnover/all (шаг 1, обнаружение
// товаров с ненулевым остатком на конец месяца) + /report/turnover/bystore
// (шаг 2, разбивка найденных товаров по складам): по одному снимку на конец
// каждого месяца от fromDate до текущего, по одной строке MoySkladStock на
// каждый склад с ненулевым количеством. Не зависит от MoySkladStore.findMany
// — состав складов берётся из ответа bystore на товар (design.md D1, D3).
// Идемпотентен — повторный запуск с тем же диапазоном апсертит по тому же
// ключу (productId, warehouseId, snapshotAt), не создаёт дублей.
describe('MoySkladSyncService.backfillHistoricalStockSnapshots (D1/D4)', () => {
    const productHref = (id: string) =>
        `https://api.moysklad.ru/api/remap/1.2/entity/product/${id}`;

    const buildService = () => {
        const upsert = jest.fn().mockResolvedValue({});
        const db = {
            moySkladStock: { upsert },
        } as unknown as DatabaseService;

        // Один и тот же товар с ненулевым остатком на каждый месяц бэкфилла,
        // плюс товар с нулевым остатком, который не должен доходить до шага 2.
        const fetchTurnoverAllAt = jest.fn(function* (
            _momentFrom: Date,
            _momentTo: Date,
        ) {
            yield [
                {
                    assortment: {
                        meta: {
                            href: productHref('product-1'),
                            type: 'product',
                        },
                    },
                    onPeriodEnd: { quantity: 3, sum: 999 },
                },
                {
                    assortment: {
                        meta: {
                            href: productHref('product-zero'),
                            type: 'product',
                        },
                    },
                    onPeriodEnd: { quantity: 0, sum: 0 },
                },
            ];
        });

        const fetchTurnoverByStoreForProduct = jest
            .fn()
            .mockResolvedValue([
                { warehouseId: 'store-1', quantity: 3, costSum: 999 },
            ]);

        const moySklad = {
            fetchTurnoverAllAt,
            fetchTurnoverByStoreForProduct,
        } as unknown as MoyskladService;

        const service = new MoySkladSyncService(db, moySklad);
        return {
            service,
            upsert,
            fetchTurnoverAllAt,
            fetchTurnoverByStoreForProduct,
        };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('для каждого месяца от fromDate до текущего запрашивает turnover/all с якорным momentFrom и пропускает товары с нулевым остатком', async () => {
        const { service, fetchTurnoverAllAt, fetchTurnoverByStoreForProduct } =
            buildService();
        const fromDate = new Date('2026-07-01T00:00:00.000Z');

        await service.backfillHistoricalStockSnapshots(fromDate);

        // Июль, август, сентябрь 2026 (текущий месяц захвачен фейковым
        // временем выше).
        expect(fetchTurnoverAllAt).toHaveBeenCalledTimes(3);

        const julyEnd = new Date('2026-07-31T23:59:59.999Z');
        const septemberEnd = new Date('2026-09-30T23:59:59.999Z');
        expect(fetchTurnoverAllAt).toHaveBeenCalledWith(
            HISTORICAL_TURNOVER_LOOKBACK_ANCHOR,
            julyEnd,
        );
        expect(fetchTurnoverAllAt).toHaveBeenCalledWith(
            HISTORICAL_TURNOVER_LOOKBACK_ANCHOR,
            septemberEnd,
        );

        // Только товар с ненулевым остатком доходит до шага 2 — один вызов
        // на месяц, товар с нулевым остатком не порождает вызова.
        expect(fetchTurnoverByStoreForProduct).toHaveBeenCalledTimes(3);
        expect(fetchTurnoverByStoreForProduct).toHaveBeenCalledWith(
            productHref('product-1'),
            'product',
            HISTORICAL_TURNOVER_LOOKBACK_ANCHOR,
            septemberEnd,
        );
    });

    it('апсертит одну строку MoySkladStock на (товар, склад, конец месяца) по данным шага 2', async () => {
        const { service, upsert } = buildService();
        const fromDate = new Date('2026-09-01T00:00:00.000Z');

        await service.backfillHistoricalStockSnapshots(fromDate);

        const septemberEnd = new Date('2026-09-30T23:59:59.999Z');
        expect(upsert).toHaveBeenCalledTimes(1);
        expect(upsert).toHaveBeenCalledWith({
            where: {
                productId_warehouseId_snapshotAt: {
                    productId: 'product-1',
                    warehouseId: 'store-1',
                    snapshotAt: septemberEnd,
                },
            },
            create: {
                id: 'generated-uuid',
                productId: 'product-1',
                warehouseId: 'store-1',
                quantity: 3,
                costSum: 999,
                snapshotAt: septemberEnd,
            },
            update: { quantity: 3, costSum: 999 },
        });
    });

    it('не создаёт строку для складской записи с нулевым количеством (D3)', async () => {
        const upsert = jest.fn().mockResolvedValue({});
        const db = {
            moySkladStock: { upsert },
        } as unknown as DatabaseService;
        const fetchTurnoverAllAt = jest.fn(function* () {
            yield [
                {
                    assortment: {
                        meta: {
                            href: productHref('product-1'),
                            type: 'product',
                        },
                    },
                    onPeriodEnd: { quantity: 3, sum: 999 },
                },
            ];
        });
        const fetchTurnoverByStoreForProduct = jest.fn().mockResolvedValue([
            { warehouseId: 'store-1', quantity: 3, costSum: 999 },
            { warehouseId: 'store-2', quantity: 0, costSum: 0 },
        ]);
        const moySklad = {
            fetchTurnoverAllAt,
            fetchTurnoverByStoreForProduct,
        } as unknown as MoyskladService;
        const service = new MoySkladSyncService(db, moySklad);

        await service.backfillHistoricalStockSnapshots(
            new Date('2026-09-01T00:00:00.000Z'),
        );

        const septemberEnd = new Date('2026-09-30T23:59:59.999Z');
        expect(upsert).toHaveBeenCalledTimes(1);
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    productId_warehouseId_snapshotAt: {
                        productId: 'product-1',
                        warehouseId: 'store-1',
                        snapshotAt: septemberEnd,
                    },
                },
            }),
        );
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

    // spec: fix-shop-turnover-historical-stock-cost D4 — сверка account-wide
    // (шаг 1, onPeriodEnd.sum строки turnover/all) и по-складской (шаг 2,
    // сумма onPeriodEnd.sum по stockByStore) суммы одного товара.
    it('при расхождении account-wide и по-складской суммы товара логирует warn с id товара и обоими значениями, не падает и продолжает бэкфилл (D4)', async () => {
        const warnSpy = jest
            .spyOn(Logger.prototype, 'warn')
            .mockImplementation();
        const upsert = jest.fn().mockResolvedValue({});
        const db = {
            moySkladStock: { upsert },
        } as unknown as DatabaseService;
        const fetchTurnoverAllAt = jest.fn(function* () {
            yield [
                {
                    assortment: {
                        meta: {
                            href: productHref('mismatched-product'),
                            type: 'product',
                        },
                    },
                    onPeriodEnd: { quantity: 5, sum: 1000 },
                },
                {
                    assortment: {
                        meta: {
                            href: productHref('next-product'),
                            type: 'product',
                        },
                    },
                    onPeriodEnd: { quantity: 1, sum: 100 },
                },
            ];
        });
        const fetchTurnoverByStoreForProduct = jest
            .fn()
            .mockResolvedValueOnce([
                { warehouseId: 'store-1', quantity: 5, costSum: 900 },
            ])
            .mockResolvedValueOnce([
                { warehouseId: 'store-1', quantity: 1, costSum: 100 },
            ]);
        const moySklad = {
            fetchTurnoverAllAt,
            fetchTurnoverByStoreForProduct,
        } as unknown as MoyskladService;
        const service = new MoySkladSyncService(db, moySklad);

        await expect(
            service.backfillHistoricalStockSnapshots(
                new Date('2026-09-01T00:00:00.000Z'),
            ),
        ).resolves.not.toThrow();

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const warnMessage = warnSpy.mock.calls[0][0] as string;
        expect(warnMessage).toContain('mismatched-product');
        expect(warnMessage).toContain('1000');
        expect(warnMessage).toContain('900');

        // Бэкфилл не падает и обрабатывает следующий товар как обычно.
        expect(fetchTurnoverByStoreForProduct).toHaveBeenCalledTimes(2);
        expect(upsert).toHaveBeenCalledTimes(2);

        warnSpy.mockRestore();
    });
});
