import { BuildShopCalculationContextService } from './build-shop-calculation-context.service';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/shop-sales-performance.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/shop-sales-performance.value-object';
import { Period } from '@/shared/domain/period.value-object';

// Юнит для BuildShopCalculationContextService (Фаза 13.5, issue #57) —
// зеркало по духу спека сборки контекста сервиса (нет отдельного файла у
// build-service-calculation-context.service.ts, но тот же стиль
// in-memory-фейков портов, что и у close-accounting-period.handler.spec.ts).
// Особое внимание — третьему параметру build(), rules: он есть только у
// shop-версии (categoryDescendantFolderIds зависит от category правил
// РАСЧЁТЫВАЕМОЙ схемы, см. комментарий у build-shop-calculation-context.service.ts).
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
    }) => {
        const findEmployeeIdentities = jest.fn().mockResolvedValue([]);
        const findHoursWorked = jest.fn().mockResolvedValue(8);
        const findProductSoldItems = jest.fn().mockResolvedValue([]);
        const findConfirmedTaskCompletions = jest.fn().mockResolvedValue([]);
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
            findConfirmedTaskCompletions,
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
            .mockResolvedValue(overrides?.performance ?? null);
        const salesPerformanceReader: ShopSalesPerformanceReaderPort = {
            listForPeriod: jest.fn().mockResolvedValue([]),
            findForScope,
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
            findConfirmedTaskCompletions,
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
            buildRule('TaskCompleted'),
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
        const rules = [buildRule('PayPerHour'), buildRule('TaskCompleted')];

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

    it('собирает identities/hoursWorked/productSoldItems/taskCompletions из БД', async () => {
        const { service, dataSource } = buildService();
        (dataSource.findEmployeeIdentities as jest.Mock).mockResolvedValue([
            {
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: '7',
            },
        ]);
        (dataSource.findHoursWorked as jest.Mock).mockResolvedValue(120);

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
        expect(context.erpData.hoursWorked).toBe(120);
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
