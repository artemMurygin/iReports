import { MoySkladSyncService } from './moysklad-sync.service';
import { DemandSchema } from '../../integrations/moySklad/schemas/demands.schema';
import { PURCHASER_ATTRIBUTE_NAME } from './moysklad-sync.mappers';
import type { MoyskladService } from '../../integrations/moySklad/moysklad.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';

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
});
