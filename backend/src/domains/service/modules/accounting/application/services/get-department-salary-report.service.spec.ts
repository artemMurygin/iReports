import { GetDepartmentSalaryReportService } from './get-department-salary-report.service';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Отчёт по отделу (Фаза 9, issue #45/#46, см.
// docs/payroll/plan-payroll-calculation.md, "Фаза 9") — тот же расчёт, что
// и у отчёта сотрудника, агрегированный по отделу без N+1. Все зависимости —
// чистые in-memory фейки со счётчиками вызовов, без NestJS DI и без БД.
describe('GetDepartmentSalaryReportService', () => {
    const buildSchema = (employeeId: number, price: number) =>
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

    const buildService = (overrides: {
        employees: { id: number; name: string }[];
        schemas?: MotivationSchema[];
        hoursByEmployee?: Map<number, number>;
        accountingPeriod?: AccountingPeriod | null;
        snapshots?: Map<
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
        };

        const findByDirectionAndPeriod = jest
            .fn()
            .mockResolvedValue(overrides.accountingPeriod ?? null);
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod,
            save: jest.fn(),
        };

        const findManyByKey = jest
            .fn()
            .mockResolvedValue(overrides.snapshots ?? new Map());
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

        const service = new GetDepartmentSalaryReportService(
            dataSource,
            salesPerformanceReader,
            motivationSchemaRepo,
            periodRepo,
            snapshotRepo,
            cacheRepo,
            domainSyncStatus,
            salesPlanRepo,
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
        };
    };

    it('итог по отделу равен сумме итогов сотрудников, итог сотрудника — сумме его правил', async () => {
        const employees = [
            { id: 1, name: 'Иван Иванов' },
            { id: 2, name: 'Пётр Петров' },
        ];
        const schemas = [buildSchema(1, 250), buildSchema(2, 300)];
        const hoursByEmployee = new Map([
            [1, 8],
            [2, 10],
        ]);

        const { service } = buildService({
            employees,
            schemas,
            hoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        expect(report.employees).toHaveLength(2);
        expect(report.employees[0]).toMatchObject({
            employeeId: 1,
            total: { fact: 2000, prognose: 2000 }, // 8 * 250
        });
        expect(report.employees[1]).toMatchObject({
            employeeId: 2,
            total: { fact: 3000, prognose: 3000 }, // 10 * 300
        });
        // Итог сотрудника = сумма его правил.
        expect(report.employees[0].total.fact).toBe(
            report.employees[0].rules.reduce(
                (sum, r) => sum + r.amount.fact,
                0,
            ),
        );
        // Итог отдела = сумма итогов сотрудников.
        expect(report.total).toEqual({ fact: 5000, prognose: 5000 });
    });

    it('расчёт отдела не порождает запросов к БД, пропорциональных числу сотрудников', async () => {
        const manyEmployees = Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            name: `Сотрудник ${i + 1}`,
        }));
        const schemas = manyEmployees.map((e) => buildSchema(e.id, 100));

        const {
            service,
            findServiceCompletedItems,
            findOrderPayedItems,
            findConfirmedTaskCompletions,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            findByEmployees,
            findForScope,
        } = buildService({ employees: manyEmployees, schemas });

        await service.execute(1, '2026-08');

        // Общие ERP-данные, SalesPerformance и мотивационные схемы читаются
        // РОВНО ОДИН РАЗ на весь отдел, независимо от того, что в отделе 20
        // сотрудников × 1 правило каждый — не 20 отдельных запросов.
        expect(findServiceCompletedItems).toHaveBeenCalledTimes(1);
        expect(findOrderPayedItems).toHaveBeenCalledTimes(1);
        expect(findConfirmedTaskCompletions).toHaveBeenCalledTimes(1);
        expect(findEmployeeIdentitiesForEmployees).toHaveBeenCalledTimes(1);
        expect(findHoursWorkedForEmployees).toHaveBeenCalledTimes(1);
        expect(findByEmployees).toHaveBeenCalledTimes(1);
        expect(findForScope).toHaveBeenCalledTimes(1);
    });

    it('закрытый период отдаёт только факт из снапшота, поля prognose пустые', async () => {
        const employees = [{ id: 1, name: 'Иван Иванов' }];
        const closedPeriod = withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-07',
            });
            period.close(1, 1);
            return period;
        });
        const snapshots = new Map([
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

        const { service } = buildService({
            employees,
            accountingPeriod: closedPeriod,
            snapshots: snapshots as never,
        });

        const report = await service.execute(1, '2026-07');

        expect(report.isClosed).toBe(true);
        expect(report.total).toEqual({ fact: 4000, prognose: null });
        expect(report.employees[0].total).toEqual({
            fact: 4000,
            prognose: null,
        });
        expect(report.employees[0].rules[0].amount).toEqual({
            fact: 4000,
            prognose: null,
        });
    });

    it('отдел без сотрудников отдаёт пустой список и нулевой итог', async () => {
        const { service } = buildService({ employees: [] });

        const report = await service.execute(999, '2026-08');

        expect(report.employees).toEqual([]);
        expect(report.total).toEqual({ fact: 0, prognose: 0 });
    });
});
