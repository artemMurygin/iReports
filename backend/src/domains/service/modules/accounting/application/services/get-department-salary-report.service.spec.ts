import { GetDepartmentSalaryReportService } from './get-department-salary-report.service';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/shop-sales-performance.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Отчёт по отделу (Фаза 9, дополнено Фазой 13.5, см.
// docs/payroll/phase-13.5-shop-report-integration.md, решение #3) — тот же
// расчёт, что и у отчёта сотрудника, агрегированный по отделу без N+1, но
// БЕЗ directions[]-разбивки: employees[].rules объединяет строки service и
// shop одним списком, верхнеуровневый isClosed — true только когда закрыты
// оба направления сразу. Все зависимости — чистые in-memory фейки со
// счётчиками вызовов, без NestJS DI и без БД.
describe('GetDepartmentSalaryReportService', () => {
    const buildServiceSchema = (employeeId: number, price: number) =>
        withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: employeeId,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });

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

    const buildClosedPeriod = (direction: 'service' | 'shop') =>
        withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction,
                period: '2026-07',
            });
            period.close(1, 1);
            return period;
        });

    const buildService = (overrides: {
        employees: { id: number; name: string }[];
        schemas?: MotivationSchema[];
        shopSchemas?: ShopMotivationSchema[];
        hoursByEmployee?: Map<number, number>;
        shopHoursByEmployee?: Map<number, number>;
        serviceAccountingPeriod?: AccountingPeriod | null;
        shopAccountingPeriod?: AccountingPeriod | null;
        serviceSnapshots?: Map<
            number,
            { employeeId: number; total: number; lines: never[] }
        >;
        shopSnapshots?: Map<
            number,
            { employeeId: number; total: number; lines: never[] }
        >;
    }) => {
        const findEmployeesInDepartment = jest
            .fn()
            .mockResolvedValue(overrides.employees);
        const findServiceCompletedItems = jest.fn().mockResolvedValue([]);
        const findOrderPayedItems = jest.fn().mockResolvedValue([]);
        const findConfirmedTaskCompletions = jest.fn().mockResolvedValue([]);
        const findEmployeeIdentitiesForEmployees = jest
            .fn()
            .mockResolvedValue(new Map());
        const findHoursWorkedForEmployees = jest
            .fn()
            .mockResolvedValue(overrides.hoursByEmployee ?? new Map());
        const dataSource: ServiceCalculationDataPort = {
            findEmployeeIdentities: jest.fn().mockResolvedValue([]),
            findServiceCompletedItems,
            findHoursWorked: jest.fn().mockResolvedValue(0),
            findOrderPayedItems,
            findConfirmedTaskCompletions,
            findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
            findEmployeesInDepartment,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
        };

        const findForScope = jest.fn().mockResolvedValue(null);
        const salesPerformanceReader: SalesPerformanceReaderPort = {
            listForPeriod: jest.fn().mockResolvedValue([]),
            findForScope,
        };

        const findByEmployees = jest
            .fn()
            .mockResolvedValue(overrides.schemas ?? []);
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByEmployees,
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
        };

        const findByDirectionAndPeriod = jest
            .fn()
            .mockImplementation((direction: 'service' | 'shop') =>
                Promise.resolve(
                    direction === 'service'
                        ? (overrides.serviceAccountingPeriod ?? null)
                        : (overrides.shopAccountingPeriod ?? null),
                ),
            );
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod,
            save: jest.fn(),
        };

        const findManyByKey = jest
            .fn()
            .mockImplementation((direction: 'service' | 'shop') =>
                Promise.resolve(
                    direction === 'service'
                        ? (overrides.serviceSnapshots ?? new Map())
                        : (overrides.shopSnapshots ?? new Map()),
                ),
            );
        const snapshotRepo: AccountingPeriodSnapshotPort = {
            saveAll: jest.fn(),
            findByKey: jest.fn(),
            findManyByKey,
            deleteByDirectionAndPeriod: jest.fn(),
        };

        const findCache = jest.fn().mockResolvedValue(null);
        const upsertCache = jest.fn().mockResolvedValue(undefined);
        const cacheRepo: AccountingCalculationCachePort = {
            find: findCache,
            upsert: upsertCache,
            deleteByDirectionAndPeriod: jest.fn(),
        };

        const domainSyncStatus: DomainSyncStatusPort = {
            getLastSuccessfulSyncAt: jest.fn().mockResolvedValue(null),
            markSuccessful: jest.fn(),
        };

        const salesPlanRepo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: jest.fn().mockResolvedValue([]),
        };

        const findProductSoldItems = jest.fn().mockResolvedValue([]);
        const findShopConfirmedTaskCompletions = jest
            .fn()
            .mockResolvedValue([]);
        const findEmployeeIdentitiesForEmployeesShop = jest
            .fn()
            .mockResolvedValue(new Map());
        const findHoursWorkedForEmployeesShop = jest
            .fn()
            .mockResolvedValue(overrides.shopHoursByEmployee ?? new Map());
        const resolveCategoryDescendantFolderIds = jest
            .fn()
            .mockResolvedValue({});
        const shopDataSource: ShopCalculationDataPort = {
            findEmployeeIdentities: jest.fn().mockResolvedValue([]),
            findHoursWorked: jest.fn().mockResolvedValue(0),
            findProductSoldItems,
            findConfirmedTaskCompletions: findShopConfirmedTaskCompletions,
            findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
            findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
            findEmployeeIdentitiesForEmployees:
                findEmployeeIdentitiesForEmployeesShop,
            findHoursWorkedForEmployees: findHoursWorkedForEmployeesShop,
            resolveCategoryDescendantFolderIds,
        };

        const findShopForScope = jest.fn().mockResolvedValue(null);
        const shopSalesPerformanceReader: ShopSalesPerformanceReaderPort = {
            listForPeriod: jest.fn().mockResolvedValue([]),
            findForScope: findShopForScope,
        };

        const findShopByEmployees = jest
            .fn()
            .mockResolvedValue(overrides.shopSchemas ?? []);
        const shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByEmployees: findShopByEmployees,
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
        };

        const service = new GetDepartmentSalaryReportService(
            dataSource,
            salesPerformanceReader,
            motivationSchemaRepo,
            periodRepo,
            snapshotRepo,
            cacheRepo,
            domainSyncStatus,
            salesPlanRepo,
            shopDataSource,
            shopMotivationSchemaRepo,
            shopSalesPerformanceReader,
        );

        return {
            service,
            findServiceCompletedItems,
            findOrderPayedItems,
            findConfirmedTaskCompletions,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            findByEmployees,
            findForScope,
            findManyByKey,
            findProductSoldItems,
            findShopConfirmedTaskCompletions,
            findEmployeeIdentitiesForEmployeesShop,
            findHoursWorkedForEmployeesShop,
            findShopByEmployees,
            findShopForScope,
        };
    };

    it('оба направления открыты — rules объединяют строки service и shop, итог сотрудника суммирует оба направления', async () => {
        const employees = [{ id: 1, name: 'Иван Иванов' }];
        const schemas = [buildServiceSchema(1, 250)];
        const shopSchemas = [buildShopSchema(1, 100)];
        const hoursByEmployee = new Map([[1, 8]]);
        const shopHoursByEmployee = new Map([[1, 5]]);

        const { service } = buildService({
            employees,
            schemas,
            shopSchemas,
            hoursByEmployee,
            shopHoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        expect(report.isClosed).toBe(false);
        expect(report.employees).toHaveLength(1);
        // 8 * 250 (service) + 5 * 100 (shop) = 2500.
        expect(report.employees[0].total).toEqual({
            fact: 2500,
            prognose: 2500,
        });
        expect(report.employees[0].rules).toHaveLength(2);
        expect(
            report.employees[0].rules
                .map((r) => r.amount.fact)
                .sort((a, b) => a - b),
        ).toEqual([500, 2000]);
        expect(report.total).toEqual({ fact: 2500, prognose: 2500 });
    });

    it('расчёт отдела не порождает запросов к БД, пропорциональных числу сотрудников (оба направления)', async () => {
        const manyEmployees = Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            name: `Сотрудник ${i + 1}`,
        }));
        const schemas = manyEmployees.map((e) => buildServiceSchema(e.id, 100));
        const shopSchemas = manyEmployees.map((e) => buildShopSchema(e.id, 50));

        const {
            service,
            findServiceCompletedItems,
            findOrderPayedItems,
            findConfirmedTaskCompletions,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            findByEmployees,
            findForScope,
            findProductSoldItems,
            findShopConfirmedTaskCompletions,
            findEmployeeIdentitiesForEmployeesShop,
            findHoursWorkedForEmployeesShop,
            findShopByEmployees,
            findShopForScope,
        } = buildService({ employees: manyEmployees, schemas, shopSchemas });

        await service.execute(1, '2026-08');

        // Общие ERP-данные, SalesPerformance и мотивационные схемы читаются
        // РОВНО ОДИН РАЗ на весь отдел по каждому направлению, независимо от
        // числа сотрудников.
        expect(findServiceCompletedItems).toHaveBeenCalledTimes(1);
        expect(findOrderPayedItems).toHaveBeenCalledTimes(1);
        expect(findConfirmedTaskCompletions).toHaveBeenCalledTimes(1);
        expect(findEmployeeIdentitiesForEmployees).toHaveBeenCalledTimes(1);
        expect(findHoursWorkedForEmployees).toHaveBeenCalledTimes(1);
        expect(findByEmployees).toHaveBeenCalledTimes(1);
        expect(findForScope).toHaveBeenCalledTimes(1);
        expect(findProductSoldItems).toHaveBeenCalledTimes(1);
        expect(findShopConfirmedTaskCompletions).toHaveBeenCalledTimes(1);
        expect(findEmployeeIdentitiesForEmployeesShop).toHaveBeenCalledTimes(1);
        expect(findHoursWorkedForEmployeesShop).toHaveBeenCalledTimes(1);
        expect(findShopByEmployees).toHaveBeenCalledTimes(1);
        expect(findShopForScope).toHaveBeenCalledTimes(1);
    });

    it('оба направления закрыты — верхнеуровневый isClosed=true, поля prognose пустые', async () => {
        const employees = [{ id: 1, name: 'Иван Иванов' }];
        const serviceAccountingPeriod = buildClosedPeriod('service');
        const shopAccountingPeriod = buildClosedPeriod('shop');
        const serviceSnapshots = new Map([
            [
                1,
                {
                    employeeId: 1,
                    total: 4000,
                    lines: [
                        {
                            ruleId: 'r1',
                            type: 'PayPerHour',
                            name: 'Почасовая ставка',
                            targetRole: 'ENGINEER' as const,
                            amount: 4000,
                            sources: [],
                        },
                    ],
                },
            ],
        ]);
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
            serviceAccountingPeriod,
            shopAccountingPeriod,
            serviceSnapshots: serviceSnapshots as never,
            shopSnapshots: shopSnapshots as never,
        });

        const report = await service.execute(1, '2026-07');

        expect(report.isClosed).toBe(true);
        expect(report.total).toEqual({ fact: 5500, prognose: null });
        expect(report.employees[0].total).toEqual({
            fact: 5500,
            prognose: null,
        });
        expect(report.employees[0].rules).toHaveLength(2);
        expect(
            report.employees[0].rules
                .map((r) => r.amount.fact)
                .sort((a, b) => a - b),
        ).toEqual([1500, 4000]);
        expect(
            report.employees[0].rules.every((r) => r.amount.prognose === null),
        ).toBe(true);
    });

    it('service закрыт, shop открыт — prognose сотрудника суммирует fact закрытого направления с prognose открытого', async () => {
        const employees = [{ id: 1, name: 'Иван Иванов' }];
        const serviceAccountingPeriod = buildClosedPeriod('service');
        const serviceSnapshots = new Map([
            [
                1,
                {
                    employeeId: 1,
                    total: 4000,
                    lines: [
                        {
                            ruleId: 'r1',
                            type: 'PayPerHour',
                            name: 'Почасовая ставка',
                            targetRole: 'ENGINEER' as const,
                            amount: 4000,
                            sources: [],
                        },
                    ],
                },
            ],
        ]);
        const shopSchemas = [buildShopSchema(1, 100)];
        const shopHoursByEmployee = new Map([[1, 5]]);

        const { service } = buildService({
            employees,
            serviceAccountingPeriod,
            serviceSnapshots: serviceSnapshots as never,
            shopSchemas,
            shopHoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        expect(report.isClosed).toBe(false);
        // fact: 4000 (service, снапшот) + 500 (5 * 100, shop) = 4500.
        expect(report.employees[0].total).toEqual({
            fact: 4500,
            prognose: 4500,
        });
        expect(report.total).toEqual({ fact: 4500, prognose: 4500 });
    });

    it('service открыт, shop закрыт — симметрично предыдущему сценарию', async () => {
        const employees = [{ id: 1, name: 'Иван Иванов' }];
        const shopAccountingPeriod = buildClosedPeriod('shop');
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
        const schemas = [buildServiceSchema(1, 250)];
        const hoursByEmployee = new Map([[1, 8]]);

        const { service } = buildService({
            employees,
            shopAccountingPeriod,
            shopSnapshots: shopSnapshots as never,
            schemas,
            hoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        expect(report.isClosed).toBe(false);
        // fact: 2000 (8 * 250, service) + 1500 (shop, снапшот) = 3500.
        expect(report.employees[0].total).toEqual({
            fact: 3500,
            prognose: 3500,
        });
        expect(report.total).toEqual({ fact: 3500, prognose: 3500 });
    });

    it('сотрудник с личной схемой только в одном направлении получает вклад только от него', async () => {
        const employees = [
            { id: 1, name: 'Только сервис' },
            { id: 2, name: 'Только магазин' },
        ];
        const schemas = [buildServiceSchema(1, 250)];
        const shopSchemas = [buildShopSchema(2, 100)];
        const hoursByEmployee = new Map([[1, 8]]);
        const shopHoursByEmployee = new Map([[2, 5]]);

        const { service } = buildService({
            employees,
            schemas,
            shopSchemas,
            hoursByEmployee,
            shopHoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        const withOnlyService = report.employees.find(
            (e) => e.employeeId === 1,
        );
        const withOnlyShop = report.employees.find((e) => e.employeeId === 2);

        expect(withOnlyService?.total).toEqual({ fact: 2000, prognose: 2000 });
        expect(withOnlyService?.rules).toHaveLength(1);
        expect(withOnlyShop?.total).toEqual({ fact: 500, prognose: 500 });
        expect(withOnlyShop?.rules).toHaveLength(1);
    });

    it('отдел без сотрудников отдаёт пустой список и нулевой итог', async () => {
        const { service } = buildService({ employees: [] });

        const report = await service.execute(999, '2026-08');

        expect(report.employees).toEqual([]);
        expect(report.total).toEqual({ fact: 0, prognose: 0 });
        expect(report.isClosed).toBe(false);
    });
});
