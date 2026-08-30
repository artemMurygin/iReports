import { GetShopDepartmentSalaryReportService } from './get-department-salary-report.service';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodSnapshotPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { ShopAccountingCalculationCachePort } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Отчёт по отделу, ограниченный ОДНИМ направлением shop — в отличие от
// GetDepartmentSalaryReportService (домен service, который сводит service
// и shop в один плоский employees[].rules с комбинированным isClosed, см.
// docs/payroll/phase-13.5-shop-report-integration.md), здесь isClosed —
// статус закрытия периода направления shop как есть, без combine-шага.
// Кейсы этого файла — исключительно shop-специфичные, перенесённые из
// GetDepartmentSalaryReportService.spec.ts (тот файл тестирует
// комбинацию направлений, сюда не переносится). Все зависимости — чистые
// in-memory фейки со счётчиками вызовов, без NestJS DI и без БД.
describe('GetShopDepartmentSalaryReportService', () => {
    const buildShopSchema = (employeeId: number, price: number) =>
        withRequestContext(() => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка (магазин)',
                targetRole: 'ONLINE_MANAGER',
                config: { price },
            });
            return ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId: employeeId,
                name: 'Оклад продавца',
                rules: [rule],
            });
        });

    const buildClosedShopPeriod = () =>
        withRequestContext(() => {
            const period = ShopAccountingPeriod.openFor('2026-07');
            period.close(1, 1);
            return period;
        });

    const buildService = (overrides: {
        employees: { id: number; name: string }[];
        shopSchemas?: ShopMotivationSchema[];
        shopHoursByEmployee?: Map<number, number>;
        shopAccountingPeriod?: ShopAccountingPeriod | null;
        shopSnapshots?: Map<
            number,
            { employeeId: number; total: number; lines: never[] }
        >;
    }) => {
        const findEmployeesInDepartment = jest
            .fn()
            .mockResolvedValue(overrides.employees);
        const findProductSoldItems = jest.fn().mockResolvedValue([]);
        const findConfirmedTaskCompletions = jest.fn().mockResolvedValue([]);
        const findEmployeeIdentitiesForEmployees = jest
            .fn()
            .mockResolvedValue(new Map());
        // shopHoursByEmployee задаётся тестами как Map<employeeId, часы>
        // (одно число) — оборачиваем в { fact, prognose } с одинаковым
        // значением, т.к. эти тесты не проверяют разницу режимов PayPerHour.
        const findHoursWorkedForEmployees = jest
            .fn()
            .mockResolvedValue(
                new Map(
                    [
                        ...(overrides.shopHoursByEmployee ??
                            new Map<number, number>()),
                    ].map(([employeeId, hours]) => [
                        employeeId,
                        { fact: hours, prognose: hours },
                    ]),
                ),
            );
        const resolveCategoryDescendantFolderIds = jest
            .fn()
            .mockResolvedValue({});
        const shopDataSource: ShopCalculationDataPort = {
            findEmployeeIdentities: jest.fn().mockResolvedValue([]),
            findHoursWorked: jest
                .fn()
                .mockResolvedValue({ fact: 0, prognose: 0 }),
            findProductSoldItems,
            findConfirmedTaskCompletions,
            findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
            findEmployeesInDepartment,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            resolveCategoryDescendantFolderIds,
        };

        const findForScope = jest.fn().mockResolvedValue(null);
        const shopSalesPerformanceReader: ShopSalesPerformanceReaderPort = {
            listForPeriod: jest.fn().mockResolvedValue([]),
            findForScope,
            listForDepartment: jest.fn().mockResolvedValue([]),
        };

        const findByEmployees = jest
            .fn()
            .mockResolvedValue(overrides.shopSchemas ?? []);
        const shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            // Схемы на отдел в этих тестах нет — forDepartment() сводится
            // ровно к findByEmployees(), как и раньше (покрытие
            // department-схемы — в resolve-shop-employee-salary-rules.spec).
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees,
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
            initializeName: jest.fn().mockResolvedValue(undefined),
        };

        const salaryRulesResolver = new ResolveShopEmployeeSalaryRulesService(
            shopMotivationSchemaRepo,
            {
                findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
                findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
            } as unknown as ShopCalculationDataPort,
        );

        const findByPeriod = jest
            .fn()
            .mockResolvedValue(overrides.shopAccountingPeriod ?? null);
        const periodRepo: ShopAccountingPeriodRepositoryPort = {
            findByPeriod,
            save: jest.fn(),
        };

        const findManyByKey = jest
            .fn()
            .mockResolvedValue(overrides.shopSnapshots ?? new Map());
        const snapshotRepo: ShopAccountingPeriodSnapshotPort = {
            saveAll: jest.fn(),
            findByKey: jest.fn(),
            findManyByKey,
            deleteByPeriod: jest.fn(),
        };

        const findCache = jest.fn().mockResolvedValue(null);
        const upsertCache = jest.fn().mockResolvedValue(undefined);
        const cacheRepo: ShopAccountingCalculationCachePort = {
            find: findCache,
            upsert: upsertCache,
            deleteByPeriod: jest.fn(),
        };

        const domainSyncStatus: DomainSyncStatusPort = {
            getLastSuccessfulSyncAt: jest.fn().mockResolvedValue(null),
            markSuccessful: jest.fn(),
        };

        const salesPlanRepo: ShopSalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByPeriod: jest.fn().mockResolvedValue([]),
        };

        const service = new GetShopDepartmentSalaryReportService(
            shopDataSource,
            shopSalesPerformanceReader,
            periodRepo,
            snapshotRepo,
            cacheRepo,
            domainSyncStatus,
            salesPlanRepo,
            salaryRulesResolver,
        );

        return {
            service,
            findEmployeesInDepartment,
            findProductSoldItems,
            findConfirmedTaskCompletions,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            resolveCategoryDescendantFolderIds,
            findForScope,
            findByEmployees,
            findByPeriod,
            findManyByKey,
        };
    };

    it('направление открыто — считает по правилам схемы, isClosed=false, prognose посчитан заново', async () => {
        const employees = [{ id: 1, name: 'Продавец' }];
        const shopSchemas = [buildShopSchema(1, 100)];
        const shopHoursByEmployee = new Map([[1, 5]]);

        const { service } = buildService({
            employees,
            shopSchemas,
            shopHoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        expect(report.isClosed).toBe(false);
        expect(report.employees).toHaveLength(1);
        // 5 * 100 = 500.
        expect(report.employees[0].total).toEqual({
            fact: 500,
            prognose: 500,
        });
        expect(report.employees[0].rules).toHaveLength(1);
        expect(report.total).toEqual({ fact: 500, prognose: 500 });
    });

    it('направление закрыто — isClosed=true, поля prognose пустые, суммы берутся из снапшота', async () => {
        const employees = [{ id: 1, name: 'Продавец' }];
        const shopAccountingPeriod = buildClosedShopPeriod();
        const shopSnapshots = new Map([
            [
                1,
                {
                    employeeId: 1,
                    total: 1500,
                    lines: [
                        {
                            ruleId: 'r2',
                            type: 'PayPerHour',
                            name: 'Почасовая ставка (магазин)',
                            targetRole: 'ONLINE_MANAGER' as const,
                            amount: 1500,
                            sources: [],
                        },
                    ],
                },
            ],
        ]);

        const { service } = buildService({
            employees,
            shopAccountingPeriod,
            shopSnapshots: shopSnapshots as never,
        });

        const report = await service.execute(1, '2026-07');

        expect(report.isClosed).toBe(true);
        expect(report.total).toEqual({ fact: 1500, prognose: null });
        expect(report.employees[0].total).toEqual({
            fact: 1500,
            prognose: null,
        });
        expect(report.employees[0].rules).toHaveLength(1);
        expect(report.employees[0].rules[0].amount.prognose).toBeNull();
    });

    it('расчёт отдела не порождает запросов к БД, пропорциональных числу сотрудников (N+1 guard)', async () => {
        const manyEmployees = Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            name: `Сотрудник ${i + 1}`,
        }));
        const shopSchemas = manyEmployees.map((e) => buildShopSchema(e.id, 50));

        const {
            service,
            findProductSoldItems,
            findConfirmedTaskCompletions,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            findByEmployees,
            findForScope,
        } = buildService({ employees: manyEmployees, shopSchemas });

        await service.execute(1, '2026-08');

        // Общие ERP-данные, SalesPerformance и мотивационные схемы читаются
        // РОВНО ОДИН РАЗ на весь отдел, независимо от числа сотрудников.
        expect(findProductSoldItems).toHaveBeenCalledTimes(1);
        expect(findConfirmedTaskCompletions).toHaveBeenCalledTimes(1);
        expect(findEmployeeIdentitiesForEmployees).toHaveBeenCalledTimes(1);
        expect(findHoursWorkedForEmployees).toHaveBeenCalledTimes(1);
        expect(findByEmployees).toHaveBeenCalledTimes(1);
        expect(findForScope).toHaveBeenCalledTimes(1);
    });

    it('сотрудник без личной схемы получает нулевой вклад, но остаётся в списке', async () => {
        const employees = [
            { id: 1, name: 'С личной схемой' },
            { id: 2, name: 'Без схемы' },
        ];
        const shopSchemas = [buildShopSchema(1, 100)];
        const shopHoursByEmployee = new Map([[1, 5]]);

        const { service } = buildService({
            employees,
            shopSchemas,
            shopHoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        const withSchema = report.employees.find((e) => e.employeeId === 1);
        const withoutSchema = report.employees.find((e) => e.employeeId === 2);

        expect(withSchema?.total).toEqual({ fact: 500, prognose: 500 });
        expect(withSchema?.rules).toHaveLength(1);
        expect(withoutSchema?.total).toEqual({ fact: 0, prognose: 0 });
        expect(withoutSchema?.rules).toEqual([]);
    });

    it('период без записи в БД трактуется как открытый', async () => {
        const employees = [{ id: 1, name: 'Продавец' }];

        const { service, findByPeriod } = buildService({
            employees,
            shopAccountingPeriod: null,
        });

        const report = await service.execute(1, '2026-08');

        expect(findByPeriod).toHaveBeenCalledWith('2026-08');
        expect(report.isClosed).toBe(false);
    });

    it('отдел без сотрудников отдаёт пустой список и нулевой итог', async () => {
        const { service } = buildService({ employees: [] });

        const report = await service.execute(999, '2026-08');

        expect(report.employees).toEqual([]);
        expect(report.total).toEqual({ fact: 0, prognose: 0 });
        expect(report.isClosed).toBe(false);
    });
});
