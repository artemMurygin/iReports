import { ProductSoldEntity } from './product-sold.entity';
import type { CalculationContext } from '@/shared/domain/calculation-context';
import type {
    ShopCalculationErpData,
    ShopProductSoldErpItem,
} from '@/domains/shop/modules/accounting/domain/types/shop-calculation-data.types';
import type {
    ShopCalculationContext,
    ShopSalesPerformanceByCategory,
} from '@/domains/shop/modules/accounting/domain/types/shop-calculation-context.types';
import { buildMoySkladDemandLink } from '@/domains/shop/modules/accounting/domain/services/moysklad-demand-link';

// Юнит-тесты на подготовленном объекте контекста — без БД и без моков
// репозиториев (issue #61, "Тесты правил ProductSold и PayPerHour
// магазина"). С Фазы 2 плана shop-sales-performance-by-category
// context.salesPerformance — карта category → percentCompletion
// (ShopSalesPerformanceByCategory, ключ null = «весь отдел»), а не
// единственное значение общего CalculationContext — см.
// shop-calculation-context.types.ts.

const buildItem = (
    overrides: Partial<ShopProductSoldErpItem> = {},
): ShopProductSoldErpItem => ({
    positionId: 'pos-1',
    demandId: 'demand-1',
    itemName: 'iPhone 15 Pro 256GB',
    demandLabel: 'А000001',
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
        salesPerformance?: ShopSalesPerformanceByCategory | null;
        categoryDescendantFolderIds?: Record<string, string[]>;
    } = {},
): ShopCalculationContext => ({
    employee: {
        id: 1,
        identities: overrides.identities ?? [
            {
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: 'employee-42',
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
    salesPerformance: overrides.salesPerformance ?? null,
});

describe('ProductSoldEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом ProductSold', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('ProductSold');
            expect(rule.targetRole).toBe('ONLINE_MANAGER');
        });
    });

    describe('award Fixed', () => {
        it('платит фиксированную сумму за единицу — сумма по quantity, а не по числу позиций', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const items = [
                buildItem({ positionId: 'p1', onlineManagerId: 'employee-42' }),
                buildItem({ positionId: 'p2', onlineManagerId: 'employee-42' }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 2,
                rate: 100,
                amount: 200,
                sources: [
                    {
                        type: 'demandPosition',
                        id: 'p1',
                        label: 'А000001',
                        link: buildMoySkladDemandLink('demand-1'),
                        itemName: 'iPhone 15 Pro 256GB',
                        amount: 100,
                    },
                    {
                        type: 'demandPosition',
                        id: 'p2',
                        label: 'А000001',
                        link: buildMoySkladDemandLink('demand-1'),
                        itemName: 'iPhone 15 Pro 256GB',
                        amount: 100,
                    },
                ],
            });
        });

        it('явное поведение на дробном quantity (весовой товар): amount = price × сумма quantity', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар (вес)',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    quantity: 1.5,
                    onlineManagerId: 'employee-42',
                }),
            ];

            const line = rule.calculate(buildContext(items));

            // 100 * 1.5 = 150, не 100 (за "одну позицию").
            expect(line.quantity).toBe(1.5);
            expect(line.amount).toBe(150);
        });
    });

    describe('award FixedPercent', () => {
        it('база REVENUE — процент от суммы позиций (sum)', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар',
                targetRole: 'OFFLINE_MANAGER',
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
                    offlineManagerId: 'employee-42',
                }),
                buildItem({
                    positionId: 'p2',
                    sum: 2000,
                    offlineManagerId: 'employee-42',
                }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line.salaryBasis).toBe('REVENUE');
            expect(line.amount).toBe(300); // 10% от (1000+2000)
        });

        it('база MARGIN — процент от маржи позиций (profit)', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар',
                targetRole: 'OFFLINE_MANAGER',
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
                    offlineManagerId: 'employee-42',
                }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line.salaryBasis).toBe('MARGIN');
            expect(line.amount).toBe(60); // 20% от 300
        });
    });

    describe('award FloatPercent', () => {
        const percentBorders = [
            {
                name: 'A',
                fromPlanPercent: 50,
                multiplier: 0.5,
                mode: 'FIX' as const,
            },
            {
                name: 'B',
                fromPlanPercent: 80,
                multiplier: 1,
                mode: 'FIX' as const,
            },
            {
                name: 'C',
                fromPlanPercent: 100,
                multiplier: 1.5,
                mode: 'FIX' as const,
            },
        ];
        const linearBorders = [
            {
                name: 'A',
                fromPlanPercent: 50,
                multiplier: 0.5,
                mode: 'LINEAR' as const,
            },
            {
                name: 'B',
                fromPlanPercent: 80,
                multiplier: 1,
                mode: 'LINEAR' as const,
            },
            {
                name: 'C',
                fromPlanPercent: 100,
                multiplier: 1.5,
                mode: 'LINEAR' as const,
            },
        ];

        it('нет записи по своей категории в карте salesPerformance — fail closed (ничего не начисляется, не бросает исключение)', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: {
                        type: 'FloatPercent',
                        basePercent: 10,
                        salaryBasis: 'REVENUE',
                        percentBorders,
                    },
                },
            });
            const items = [
                buildItem({ sum: 1000, onlineManagerId: 'employee-42' }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line).toEqual({
                ruleId: rule.id,
                salaryBasis: 'REVENUE',
                quantity: 0,
                rate: 0,
                amount: 0,
                sources: [],
            });
        });

        it('карта salesPerformance есть, но без записи по своей категории (только по чужой) — тоже fail closed', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За технику',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: 'root-folder',
                    award: {
                        type: 'FloatPercent',
                        basePercent: 10,
                        salaryBasis: 'REVENUE',
                        percentBorders,
                    },
                },
            });
            const items = [
                buildItem({
                    sum: 1000,
                    folderId: 'root-folder',
                    onlineManagerId: 'employee-42',
                }),
            ];

            const amount = rule.calculate(
                buildContext(items, {
                    categoryDescendantFolderIds: {
                        'root-folder': ['root-folder'],
                    },
                    // В карте есть только "весь отдел" (null) и другая
                    // категория — но не 'root-folder' самого правила.
                    salesPerformance: new Map([
                        [null, 100],
                        ['other-folder', 100],
                    ]),
                }),
            ).amount;

            expect(amount).toBe(0);
        });

        it('режим FIX — меняет результат при разном проценте выполнения плана СВОЕЙ (null) категории', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: {
                        type: 'FloatPercent',
                        basePercent: 10,
                        salaryBasis: 'REVENUE',
                        percentBorders,
                    },
                },
            });
            const items = [
                buildItem({ sum: 1000, onlineManagerId: 'employee-42' }),
            ];

            const low = rule.calculate(
                buildContext(items, {
                    salesPerformance: new Map([[null, 60]]),
                }),
            ).amount;
            const high = rule.calculate(
                buildContext(items, {
                    salesPerformance: new Map([[null, 100]]),
                }),
            ).amount;

            // 60% -> множитель предыдущего порога (0.5): 1000 * 10% * 0.5 = 50
            expect(low).toBe(50);
            // 100% -> множитель старшего порога (1.5): 1000 * 10% * 1.5 = 150
            expect(high).toBe(150);
            expect(low).not.toBe(high);
        });

        it('режим LINEAR — интерполирует множитель между порогами по СВОЕЙ (null) категории', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: {
                        type: 'FloatPercent',
                        basePercent: 10,
                        salaryBasis: 'REVENUE',
                        percentBorders: linearBorders,
                    },
                },
            });
            const items = [
                buildItem({ sum: 1000, onlineManagerId: 'employee-42' }),
            ];

            // Ровно между 50 (×0.5) и 80 (×1) — 65%, интерполяция даёт ×0.75.
            const amount = rule.calculate(
                buildContext(items, {
                    salesPerformance: new Map([[null, 65]]),
                }),
            ).amount;

            expect(amount).toBe(75); // 1000 * 10% * 0.75
        });

        it('правило на конкретную категорию считает по проценту выполнения плана СВОЕЙ категории, а не отдела целиком (Фаза 2, issue #60)', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За технику',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: 'root-folder',
                    award: {
                        type: 'FloatPercent',
                        basePercent: 10,
                        salaryBasis: 'REVENUE',
                        percentBorders,
                    },
                },
            });
            const items = [
                buildItem({
                    sum: 1000,
                    folderId: 'root-folder',
                    onlineManagerId: 'employee-42',
                }),
            ];
            const context = buildContext(items, {
                categoryDescendantFolderIds: {
                    'root-folder': ['root-folder'],
                },
                // Отдел целиком выполнен всего на 40% (ниже нижнего порога —
                // множитель 0, начисление было бы 0), а СВОЯ категория
                // правила ('root-folder') — на 90% (между порогами B и C,
                // FIX даёт множитель B = 1). Разные значения по разным
                // ключам карты — заведомо разный результат в зависимости от
                // того, какой ключ читает правило.
                salesPerformance: new Map([
                    [null, 40],
                    ['root-folder', 90],
                ]),
            });

            const line = rule.calculate(context);

            // 1000 * 10% * 1 (множитель 90% между 80 и 100 в режиме FIX) = 100,
            // а не 0 (что дал бы процент отдела 40%).
            expect(line.amount).toBe(100);
            expect(line.rate).toBe(10); // basePercent * multiplier = 10 * 1
        });
    });

    describe('категория', () => {
        it('без категории (null) учитывает все товары', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За проданный товар',
                targetRole: 'ONLINE_MANAGER',
                config: { category: null, award: { type: 'Fixed', price: 10 } },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    folderId: 'folder-a',
                    onlineManagerId: 'employee-42',
                }),
                buildItem({
                    positionId: 'p2',
                    folderId: 'folder-b',
                    onlineManagerId: 'employee-42',
                }),
            ];

            expect(rule.calculate(buildContext(items)).quantity).toBe(2);
        });

        it('захватывает вложенные папки категории (правило на родительскую папку учитывает товары дочерних)', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За технику',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: 'root-folder',
                    award: { type: 'Fixed', price: 10 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p-root',
                    folderId: 'root-folder',
                    onlineManagerId: 'employee-42',
                }),
                buildItem({
                    positionId: 'p-child',
                    folderId: 'child-folder',
                    onlineManagerId: 'employee-42',
                }),
            ];

            const line = rule.calculate(
                buildContext(items, {
                    categoryDescendantFolderIds: {
                        'root-folder': ['root-folder', 'child-folder'],
                    },
                }),
            );

            expect(line.quantity).toBe(2);
            expect(line.sources).toEqual([
                {
                    type: 'demandPosition',
                    id: 'p-root',
                    label: 'А000001',
                    link: buildMoySkladDemandLink('demand-1'),
                    itemName: 'iPhone 15 Pro 256GB',
                    amount: 10,
                },
                {
                    type: 'demandPosition',
                    id: 'p-child',
                    label: 'А000001',
                    link: buildMoySkladDemandLink('demand-1'),
                    itemName: 'iPhone 15 Pro 256GB',
                    amount: 10,
                },
            ]);
        });

        it('не учитывает позиции вне категории, даже если они в той же отгрузке', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За технику',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: 'root-folder',
                    award: { type: 'Fixed', price: 10 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p-in',
                    demandId: 'demand-1',
                    folderId: 'root-folder',
                    onlineManagerId: 'employee-42',
                }),
                buildItem({
                    positionId: 'p-out',
                    demandId: 'demand-1',
                    folderId: 'other-folder',
                    onlineManagerId: 'employee-42',
                }),
            ];

            const line = rule.calculate(
                buildContext(items, {
                    categoryDescendantFolderIds: {
                        'root-folder': ['root-folder'],
                    },
                }),
            );

            expect(line.quantity).toBe(1);
            expect(line.sources).toEqual([
                {
                    type: 'demandPosition',
                    id: 'p-in',
                    label: 'А000001',
                    link: buildMoySkladDemandLink('demand-1'),
                    itemName: 'iPhone 15 Pro 256GB',
                    amount: 10,
                },
            ]);
        });

        it('категория задана, но контекст не принёс её раскрытия — fail closed (ничего не засчитывается)', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За технику',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: 'root-folder',
                    award: { type: 'Fixed', price: 10 },
                },
            });
            const items = [
                buildItem({
                    folderId: 'root-folder',
                    onlineManagerId: 'employee-42',
                }),
            ];

            expect(rule.calculate(buildContext(items)).amount).toBe(0);
        });
    });

    describe('роли отгрузки: онлайн-/офлайн-менеджер', () => {
        it('одна отгрузка оплачивается онлайн- и офлайн-менеджеру независимо', () => {
            const onlineRule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'Онлайн-менеджер',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const offlineRule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'Офлайн-менеджер',
                targetRole: 'OFFLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    onlineManagerId: 'employee-online',
                    offlineManagerId: 'employee-offline',
                }),
            ];
            const contextOnline = buildContext(items, {
                identities: [
                    {
                        system: 'MOY_SKLAD',
                        identifierType: 'EMPLOYEE_ID',
                        externalId: 'employee-online',
                    },
                ],
            });
            const contextOffline = buildContext(items, {
                identities: [
                    {
                        system: 'MOY_SKLAD',
                        identifierType: 'EMPLOYEE_ID',
                        externalId: 'employee-offline',
                    },
                ],
            });

            expect(onlineRule.calculate(contextOnline).amount).toBe(100);
            expect(offlineRule.calculate(contextOffline).amount).toBe(100);
            // Разные сотрудники — офлайн-правило не платит онлайн-сотруднику.
            expect(offlineRule.calculate(contextOnline).amount).toBe(0);
        });

        it('онлайн- и офлайн-менеджер — один и тот же сотрудник: платят оба правила независимо (не двойное начисление одного правила)', () => {
            const onlineRule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'Онлайн-менеджер',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const offlineRule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'Офлайн-менеджер',
                targetRole: 'OFFLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const items = [
                buildItem({
                    positionId: 'p1',
                    onlineManagerId: 'employee-42',
                    offlineManagerId: 'employee-42',
                }),
            ];
            const context = buildContext(items);

            // Два РАЗНЫХ правила — каждое считает независимо (не 0 и не
            // суммируется внутри одного расчёта): не является "двойным
            // начислением" по смыслу issue #61, это оплата по двум разным
            // правилам.
            expect(onlineRule.calculate(context).amount).toBe(100);
            expect(offlineRule.calculate(context).amount).toBe(100);
        });

        it('дедупликация «правило × позиция»: дубль одной и той же позиции в источнике не удваивает сумму', () => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'Онлайн-менеджер',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
            });
            const duplicated = buildItem({
                positionId: 'p1',
                onlineManagerId: 'employee-42',
            });

            const line = rule.calculate(
                buildContext([duplicated, { ...duplicated }]),
            );

            expect(line.quantity).toBe(1);
            expect(line.amount).toBe(100);
        });
    });
});
