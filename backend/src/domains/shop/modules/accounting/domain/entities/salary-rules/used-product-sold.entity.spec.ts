import { UsedProductSoldEntity } from './used-product-sold.entity';
import { ProductSoldEntity } from './product-sold.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type {
    ShopCalculationErpData,
    ShopProductSoldErpItem,
} from '@/domains/shop/modules/accounting/domain/types/shop-calculation-data.types';

// Юнит-тесты на подготовленном объекте контекста — без БД и без моков
// репозиториев (issue #66, "Тесты UsedProductSold").

const buildItem = (
    overrides: Partial<ShopProductSoldErpItem> = {},
): ShopProductSoldErpItem => ({
    positionId: 'pos-1',
    demandId: 'demand-1',
    folderId: null,
    quantity: 1,
    sum: 1000,
    profit: 400,
    onlineManagerId: null,
    offlineManagerId: null,
    onlinePurchaserId: null,
    offlinePurchaserId: null,
    ...overrides,
});

const buildContext = (
    items: ShopProductSoldErpItem[],
    overrides: {
        identities?: CalculationContext['employee']['identities'];
        categoryDescendantFolderIds?: Record<string, string[]>;
    } = {},
): CalculationContext => ({
    employee: {
        id: 1,
        identities: overrides.identities ?? [
            {
                system: 'MOY_SKLAD',
                identifierType: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
                externalId: 'purchaser-42',
            },
        ],
    },
    period: {
        direction: 'shop',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: {
        productSoldItems: items,
        categoryDescendantFolderIds: overrides.categoryDescendantFolderIds,
    } satisfies ShopCalculationErpData,
    salesPerformance: null,
});

describe('UsedProductSoldEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом UsedProductSold', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ техники',
                targetRole: 'ONLINE_PURCHASER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 500 },
                },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('UsedProductSold');
            expect(rule.targetRole).toBe('ONLINE_PURCHASER');
        });
    });

    describe('award Fixed', () => {
        it('платит фиксированную сумму за единицу проданного устройства', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ техники',
                targetRole: 'ONLINE_PURCHASER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 500 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    onlinePurchaserId: 'purchaser-42',
                }),
                buildItem({
                    positionId: 'p2',
                    onlinePurchaserId: 'purchaser-42',
                }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 2,
                rate: 500,
                amount: 1000,
                sources: [
                    { type: 'demandPosition', id: 'p1' },
                    { type: 'demandPosition', id: 'p2' },
                ],
            });
        });
    });

    describe('award FixedPercent', () => {
        it('база REVENUE — процент от суммы позиций (sum)', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ техники',
                targetRole: 'OFFLINE_PURCHASER',
                config: {
                    category: null,
                    award: {
                        type: 'FixedPercent',
                        percent: 10,
                        salaryBasis: 'REVENUE',
                    },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    sum: 1000,
                    offlinePurchaserId: 'purchaser-42',
                }),
                buildItem({
                    positionId: 'p2',
                    sum: 2000,
                    offlinePurchaserId: 'purchaser-42',
                }),
            ];

            const line = rule.calculate(
                buildContext(items, {
                    identities: [
                        {
                            system: 'MOY_SKLAD',
                            identifierType: 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD',
                            externalId: 'purchaser-42',
                        },
                    ],
                }),
            );

            expect(line.salaryBasis).toBe('REVENUE');
            expect(line.amount).toBe(300); // 10% от (1000+2000)
        });

        it('база MARGIN — основная для БУ техники: процент от маржи (profit)', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ техники',
                targetRole: 'ONLINE_PURCHASER',
                config: {
                    category: null,
                    award: {
                        type: 'FixedPercent',
                        percent: 20,
                        salaryBasis: 'MARGIN',
                    },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    sum: 1000,
                    profit: 300,
                    onlinePurchaserId: 'purchaser-42',
                }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line.salaryBasis).toBe('MARGIN');
            expect(line.amount).toBe(60); // 20% от 300
        });
    });

    describe('категория', () => {
        it('без категории (null) учитывает все товары', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ техники',
                targetRole: 'ONLINE_PURCHASER',
                config: { category: null, award: { type: 'Fixed', price: 10 } },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    folderId: 'folder-a',
                    onlinePurchaserId: 'purchaser-42',
                }),
                buildItem({
                    positionId: 'p2',
                    folderId: 'folder-b',
                    onlinePurchaserId: 'purchaser-42',
                }),
            ];

            expect(rule.calculate(buildContext(items)).quantity).toBe(2);
        });

        it('раздельная ставка за категорию (БУ айфон vs БУ ноутбук) — не учитывает позиции вне категории', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ айфонов',
                targetRole: 'ONLINE_PURCHASER',
                config: {
                    category: 'iphones-folder',
                    award: { type: 'Fixed', price: 10 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p-iphone',
                    folderId: 'iphones-folder',
                    onlinePurchaserId: 'purchaser-42',
                }),
                buildItem({
                    positionId: 'p-laptop',
                    folderId: 'laptops-folder',
                    onlinePurchaserId: 'purchaser-42',
                }),
            ];

            const line = rule.calculate(
                buildContext(items, {
                    categoryDescendantFolderIds: {
                        'iphones-folder': ['iphones-folder'],
                    },
                }),
            );

            expect(line.quantity).toBe(1);
            expect(line.sources).toEqual([
                { type: 'demandPosition', id: 'p-iphone' },
            ]);
        });
    });

    describe('роль закупщика: моментом начисления является продажа, а не выкуп', () => {
        it('отгрузка с двумя БУ-устройствами от разных закупщиков начисляет каждому только его позицию', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ техники',
                targetRole: 'ONLINE_PURCHASER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    demandId: 'demand-1',
                    onlinePurchaserId: 'purchaser-a',
                }),
                buildItem({
                    positionId: 'p2',
                    demandId: 'demand-1',
                    onlinePurchaserId: 'purchaser-b',
                }),
            ];
            const contextA = buildContext(items, {
                identities: [
                    {
                        system: 'MOY_SKLAD',
                        identifierType: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
                        externalId: 'purchaser-a',
                    },
                ],
            });
            const contextB = buildContext(items, {
                identities: [
                    {
                        system: 'MOY_SKLAD',
                        identifierType: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
                        externalId: 'purchaser-b',
                    },
                ],
            });

            const lineA = rule.calculate(contextA);
            const lineB = rule.calculate(contextB);

            expect(lineA.amount).toBe(100);
            expect(lineA.sources).toEqual([
                { type: 'demandPosition', id: 'p1' },
            ]);
            expect(lineB.amount).toBe(100);
            expect(lineB.sources).toEqual([
                { type: 'demandPosition', id: 'p2' },
            ]);
        });

        it('позиция без заполненного поля закупщика (offline/online) не попадает ни в чей расчёт', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ техники',
                targetRole: 'ONLINE_PURCHASER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p-unpurchased',
                    onlinePurchaserId: null,
                    offlinePurchaserId: null,
                }),
            ];

            expect(rule.calculate(buildContext(items)).amount).toBe(0);
        });

        it('дедупликация «правило × позиция»: дубль одной и той же позиции в источнике не удваивает сумму', () => {
            const rule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Закупщик БУ техники',
                targetRole: 'ONLINE_PURCHASER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const duplicated = buildItem({
                positionId: 'p1',
                onlinePurchaserId: 'purchaser-42',
            });

            const line = rule.calculate(
                buildContext([duplicated, { ...duplicated }]),
            );

            expect(line.quantity).toBe(1);
            expect(line.amount).toBe(100);
        });
    });

    describe('продавец и закупщик — один и тот же сотрудник (issue #65)', () => {
        it('ProductSold (продавцу) и UsedProductSold (закупщику) платят независимо — не двойное начисление', () => {
            const sellerRule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'Онлайн-менеджер',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const purchaserRule = UsedProductSoldEntity.create({
                type: 'UsedProductSold',
                name: 'Онлайн-закупщик',
                targetRole: 'ONLINE_PURCHASER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 300 },
                },
            });
            // Один и тот же сотрудник одновременно продал (менеджер) и
            // когда-то выкупил (закупщик) это же БУ-устройство.
            const items = [
                buildItem({
                    positionId: 'p1',
                    onlineManagerId: 'employee-same',
                    onlinePurchaserId: 'employee-same',
                }),
            ];
            const context: CalculationContext = {
                employee: {
                    id: 1,
                    identities: [
                        {
                            system: 'MOY_SKLAD',
                            identifierType: 'EMPLOYEE_ID',
                            externalId: 'employee-same',
                        },
                        {
                            system: 'MOY_SKLAD',
                            identifierType: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
                            externalId: 'employee-same',
                        },
                    ],
                },
                period: {
                    direction: 'shop',
                    period: '2026-08',
                    from: new Date('2026-08-01T00:00:00.000Z'),
                    to: new Date('2026-08-31T23:59:59.999Z'),
                    status: 'OPEN',
                },
                mode: 'FACT',
                erpData: {
                    productSoldItems: items,
                } satisfies ShopCalculationErpData,
                salesPerformance: null,
            };

            const sellerLine = sellerRule.calculate(context);
            const purchaserLine = purchaserRule.calculate(context);

            // Оба правила отработали независимо на полную сумму каждое —
            // ни одно не обнулилось и не удвоилось из-за совпадения
            // сотрудника в двух ролях.
            expect(sellerLine.amount).toBe(100);
            expect(purchaserLine.amount).toBe(300);
        });
    });
});
