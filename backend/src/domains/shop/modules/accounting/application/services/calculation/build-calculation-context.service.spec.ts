import { BuildShopCalculationContextService } from './build-calculation-context.service';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/sales-performance.value-object';
import { Period } from '@/shared/domain/period.value-object';

// Юнит для BuildShopCalculationContextService (Фаза 13.5, issue #57) —
// зеркало по духу спека сборки контекста сервиса (нет отдельного файла у
// build-service-calculation-context.service.ts, но тот же стиль
// in-memory-фейков портов, что и у close-accounting-period.handler.spec.ts).
// Особое внимание — третьему параметру build(), rules: он есть только у
// shop-версии (categoryDescendantFolderIds зависит от category правил
// РАСЧЁТЫВАЕМОЙ схемы, см. комментарий у build-calculation-context.service.ts).
describe('BuildShopCalculationContextService', () => {
    const buildRule = (
        type: ShopSalaryRule['type'],
        category?: string | null,
    ): ShopSalaryRule =>
        ({
            id: `rule-${type}-${category ?? 'null'}`,
            name: type,
            type,
            targetRole: 'ONLINE_MANAGER',
            config: category === undefined ? {} : { category },
            updatedAt: new Date(),
            calculate: jest.fn(),
        }) as unknown as ShopSalaryRule;

    const buildService = (overrides?: {
        departmentId?: number | null;
        performance?: ShopSalesPerformance | null;
        // Позволяет резолвить разные ShopSalesPerformance по разным
        // category (findForScope третьим аргументом) — иначе один и тот же
        // mockResolvedValue(performance) вернулся бы для ЛЮБОЙ category, и
        // тест не отличил бы "резолвим один раз на сотрудника" от "резолвим
        // по каждой уникальной category".
        performanceByCategory?: Record<string, ShopSalesPerformance | null>;
    }) => {
        const findEmployeeIdentities = jest.fn().mockResolvedValue([]);
        const findHoursWorked = jest
            .fn()
            .mockResolvedValue({ fact: 8, prognose: 8 });
        const findProductSoldItems = jest.fn().mockResolvedValue([]);
        const findEmployeeDepartmentId = jest
            .fn()
            .mockResolvedValue(overrides?.departmentId ?? null);
        const resolveCategoryDescendantFolderIds = jest
            .fn()
            .mockResolvedValue({ 'root-1': ['root-1', 'child-1'] });

        const dataSource: ShopCalculationDataPort = {
            findEmployeeIdentities,
            findHoursWorked,
            findProductSoldItems,
            findEmployeeDepartmentId,
            findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
            findEmployeeIdentitiesForEmployees: jest
                .fn()
                .mockResolvedValue(new Map()),
            findHoursWorkedForEmployees: jest.fn().mockResolvedValue(new Map()),
            resolveCategoryDescendantFolderIds,
        };

        const findForScope = jest
            .fn()
            .mockImplementation(
                (
                    _period: string,
                    _department: number,
                    category: string | null,
                ) => {
                    if (overrides?.performanceByCategory && category !== null) {
                        return Promise.resolve(
                            overrides.performanceByCategory[category] ?? null,
                        );
                    }
                    return Promise.resolve(overrides?.performance ?? null);
                },
            );
        const salesPerformanceReader: ShopSalesPerformanceReaderPort = {
            listForPeriod: jest.fn().mockResolvedValue([]),
            findForScope,
            listForDepartment: jest.fn().mockResolvedValue([]),
        };

        const service = new BuildShopCalculationContextService(
            dataSource,
            salesPerformanceReader,
        );

        return {
            service,
            dataSource,
            salesPerformanceReader,
            findEmployeeIdentities,
            findHoursWorked,
            findProductSoldItems,
            findEmployeeDepartmentId,
            resolveCategoryDescendantFolderIds,
            findForScope,
        };
    };

    it('раскрывает category только у правил ProductSold/UsedProductSold, дедуплицируя id', async () => {
        const { service, resolveCategoryDescendantFolderIds } = buildService();
        const rules = [
            buildRule('PayPerHour'),
            buildRule('ProductSold', 'root-1'),
            buildRule('UsedProductSold', 'root-1'),
            buildRule('ProductSold', null),
        ];

        const context = await service.build(Period.create('2026-01'), 1, rules);

        expect(resolveCategoryDescendantFolderIds).toHaveBeenCalledTimes(1);
        expect(resolveCategoryDescendantFolderIds).toHaveBeenCalledWith([
            'root-1',
        ]);
        expect(context.erpData.categoryDescendantFolderIds).toEqual({
            'root-1': ['root-1', 'child-1'],
        });
    });

    it('нет правил с category — resolveCategoryDescendantFolderIds не вызывается', async () => {
        const { service, resolveCategoryDescendantFolderIds } = buildService();
        const rules = [buildRule('PayPerHour')];

        const context = await service.build(Period.create('2026-01'), 1, rules);

        expect(resolveCategoryDescendantFolderIds).not.toHaveBeenCalled();
        expect(context.erpData.categoryDescendantFolderIds).toEqual({});
    });

    it('нет отдела у сотрудника — salesPerformanceDetail null, в модуль sales не ходим', async () => {
        const { service, findForScope } = buildService({
            departmentId: null,
        });

        const context = await service.build(Period.create('2026-01'), 1, []);

        expect(context.salesPerformanceDetail).toBeNull();
        expect(findForScope).not.toHaveBeenCalled();
    });

    it('есть отдел — ищет ShopSalesPerformance по отделу без категории', async () => {
        const performance = { fake: true } as unknown as ShopSalesPerformance;
        const { service, findForScope } = buildService({
            departmentId: 42,
            performance,
        });

        const context = await service.build(Period.create('2026-01'), 1, []);

        expect(findForScope).toHaveBeenCalledWith('2026-01', 42, null);
        expect(context.salesPerformanceDetail).toBe(performance);
    });

    describe('salesPerformanceByCategory (Фаза 2 плана shop-sales-performance-by-category)', () => {
        it('резолвит salesPerformance отдельным вызовом findForScope на каждую уникальную category правил схемы, а не один раз на сотрудника', async () => {
            const departmentPerformance = {
                department: true,
            } as unknown as ShopSalesPerformance;
            const categoryAPerformance = {
                category: 'a',
            } as unknown as ShopSalesPerformance;
            const categoryBPerformance = {
                category: 'b',
            } as unknown as ShopSalesPerformance;
            const { service, findForScope } = buildService({
                departmentId: 7,
                performance: departmentPerformance,
                performanceByCategory: {
                    'cat-a': categoryAPerformance,
                    'cat-b': categoryBPerformance,
                },
            });
            const rules = [
                buildRule('ProductSold', 'cat-a'),
                buildRule('UsedProductSold', 'cat-b'),
                // Дубликат категории 'cat-a' у другого правила — не должен
                // породить второй вызов findForScope на эту же category.
                buildRule('ProductSold', 'cat-a'),
            ];

            const context = await service.build(
                Period.create('2026-01'),
                1,
                rules,
            );

            // Один вызов на "весь отдел" (category: null, переиспользован из
            // salesPerformanceDetail) + один на каждую уникальную category
            // ('cat-a', 'cat-b') — не 2 * количество ProductSold/UsedProductSold
            // правил и не единственный вызов на сотрудника целиком.
            expect(findForScope).toHaveBeenCalledTimes(3);
            expect(findForScope).toHaveBeenCalledWith('2026-01', 7, null);
            expect(findForScope).toHaveBeenCalledWith('2026-01', 7, 'cat-a');
            expect(findForScope).toHaveBeenCalledWith('2026-01', 7, 'cat-b');

            expect(context.salesPerformanceByCategory).toEqual(
                new Map([
                    [null, departmentPerformance],
                    ['cat-a', categoryAPerformance],
                    ['cat-b', categoryBPerformance],
                ]),
            );
        });

        it('category правила без найденной строки плана/факта — отсутствует в карте (fail closed резолвится дальше, в самом правиле)', async () => {
            const departmentPerformance = {
                department: true,
            } as unknown as ShopSalesPerformance;
            const { service } = buildService({
                departmentId: 7,
                performance: departmentPerformance,
                performanceByCategory: {
                    'cat-with-plan': {
                        found: true,
                    } as unknown as ShopSalesPerformance,
                    // 'cat-without-plan' намеренно отсутствует в объекте —
                    // findForScope резолвится в null для неё.
                },
            });
            const rules = [
                buildRule('ProductSold', 'cat-with-plan'),
                buildRule('ProductSold', 'cat-without-plan'),
            ];

            const context = await service.build(
                Period.create('2026-01'),
                1,
                rules,
            );

            expect(
                context.salesPerformanceByCategory.has('cat-without-plan'),
            ).toBe(false);
            expect(
                context.salesPerformanceByCategory.get('cat-with-plan'),
            ).toEqual({
                found: true,
            });
        });

        it('нет правил с category — карта несёт только запись "весь отдел" (null), findForScope вызывается один раз', async () => {
            const departmentPerformance = {
                department: true,
            } as unknown as ShopSalesPerformance;
            const { service, findForScope } = buildService({
                departmentId: 7,
                performance: departmentPerformance,
            });
            const rules = [buildRule('PayPerHour')];

            const context = await service.build(
                Period.create('2026-01'),
                1,
                rules,
            );

            expect(findForScope).toHaveBeenCalledTimes(1);
            expect(context.salesPerformanceByCategory).toEqual(
                new Map([[null, departmentPerformance]]),
            );
        });
    });

    it('собирает identities/hoursWorked/productSoldItems из БД', async () => {
        const { service, dataSource } = buildService();
        (dataSource.findEmployeeIdentities as jest.Mock).mockResolvedValue([
            {
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: '7',
            },
        ]);
        (dataSource.findHoursWorked as jest.Mock).mockResolvedValue({
            fact: 120,
            prognose: 120,
        });

        const context = await service.build(Period.create('2026-01'), 7, []);

        expect(context.employee).toEqual({
            id: 7,
            identities: [
                {
                    system: 'MOY_SKLAD',
                    identifierType: 'EMPLOYEE_ID',
                    externalId: '7',
                },
            ],
        });
        expect(context.erpData.hoursWorked).toEqual({
            fact: 120,
            prognose: 120,
        });
        expect(context.period.direction).toBe('shop');
        expect(context.period.period).toBe('2026-01');
    });

    describe('findSalesPerformanceForEmployee', () => {
        it('нет отдела — null, без похода в модуль sales', async () => {
            const { service, findForScope } = buildService({
                departmentId: null,
            });

            const result = await service.findSalesPerformanceForEmployee(
                Period.create('2026-01'),
                1,
            );

            expect(result).toBeNull();
            expect(findForScope).not.toHaveBeenCalled();
        });

        it('есть отдел — тот же findForScope, что и build()', async () => {
            const performance = {
                fake: true,
            } as unknown as ShopSalesPerformance;
            const { service, findForScope } = buildService({
                departmentId: 5,
                performance,
            });

            const result = await service.findSalesPerformanceForEmployee(
                Period.create('2026-01'),
                1,
            );

            expect(findForScope).toHaveBeenCalledWith('2026-01', 5, null);
            expect(result).toBe(performance);
        });
    });
});
