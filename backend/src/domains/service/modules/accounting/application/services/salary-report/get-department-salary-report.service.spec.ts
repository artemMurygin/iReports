import { GetDepartmentSalaryReportService } from './get-department-salary-report.service';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { EnsureSalaryTaskForPeriodService } from '@/domains/service/modules/accounting/application/services/salary-task/ensure-salary-task-for-period.service';
import type { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';

// Отчёт по отделу (Фаза 9) — тот же расчёт, что и у отчёта сотрудника,
// агрегированный по отделу без N+1. Отчёт строго однонаправленный (только
// service, см. шапку get-department-salary-report.service.ts) — кросс-
// доменное сведение с shop, которое здесь раньше проверялось (Фаза 13.5),
// удалено вместе с самой логикой сведения. Все зависимости — чистые
// in-memory фейки со счётчиками вызовов, без NestJS DI и без БД.
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

    const buildClosedPeriod = () =>
        withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-07',
            });
            period.close(1, 1);
            return period;
        });

    const buildService = (overrides: {
        employees: { id: number; name: string }[];
        schemas?: MotivationSchema[];
        hoursByEmployee?: Map<number, number>;
        serviceAccountingPeriod?: AccountingPeriod | null;
        serviceSnapshots?: Map<
            number,
            { employeeId: number; total: number; lines: never[] }
        >;
        salaryTasks?: SalaryTask[];
    }) => {
        const findEmployeesInDepartment = jest
            .fn()
            .mockResolvedValue(overrides.employees);
        const findServiceCompletedItems = jest.fn().mockResolvedValue([]);
        const findOrderPayedItems = jest.fn().mockResolvedValue([]);
        const findEmployeeIdentitiesForEmployees = jest
            .fn()
            .mockResolvedValue(new Map());
        // hoursByEmployee задаётся тестами как Map<employeeId, часы> (одно
        // число) — оборачиваем в { fact, prognose } с одинаковым значением,
        // т.к. эти тесты не проверяют разницу режимов PayPerHour.
        const findHoursWorkedForEmployees = jest
            .fn()
            .mockResolvedValue(
                new Map(
                    [
                        ...(overrides.hoursByEmployee ??
                            new Map<number, number>()),
                    ].map(([employeeId, hours]) => [
                        employeeId,
                        { fact: hours, prognose: hours },
                    ]),
                ),
            );
        const dataSource: ServiceCalculationDataPort = {
            findEmployeeIdentities: jest.fn().mockResolvedValue([]),
            findServiceCompletedItems,
            findHoursWorked: jest
                .fn()
                .mockResolvedValue({ fact: 0, prognose: 0 }),
            findOrderPayedItems,
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

        // ResolveEmployeeSalaryRulesService.forDepartment() — единственный
        // легальный вход к правилам сотрудников отдела для этого отчёта (см.
        // шапку файла сервиса); построен поверх тех же фейков motivationSchemaRepo/
        // dataSource, что и раньше читал сервис напрямую.
        // Служебные аккаунты (docs/employee-ordering-and-salary-filter,
        // Фаза 3) уже отсеяны на входе этого сервиса — overrides.employees
        // симулирует уже отфильтрованный findEmployeesInDepartment (см. WHY
        // в ServiceCalculationDataRepository.findEmployeesInDepartment),
        // поэтому здесь достаточно пустого множества.
        const directoryRepo = {
            findServiceAccountEmployeeIds: () =>
                Promise.resolve(new Set<number>()),
        } as unknown as DirectoryRepositoryPort;
        const salaryRulesResolver = new ResolveEmployeeSalaryRulesService(
            motivationSchemaRepo,
            dataSource,
            directoryRepo,
        );

        const findByDirectionAndPeriod = jest
            .fn()
            .mockResolvedValue(overrides.serviceAccountingPeriod ?? null);
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod,
            save: jest.fn(),
        };

        const findManyByKey = jest
            .fn()
            .mockResolvedValue(overrides.serviceSnapshots ?? new Map());
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

        // Раздел 11 tasks.md (add-task-based-salary-rule) — см. WHY у
        // ensureSalaryTask в get-employee-salary-report.service.spec.ts:
        // фикстуры этого файла не содержат TaskCompletion-правил, ensure()
        // не вызывается.
        const ensureSalaryTask = {
            ensure: jest.fn(),
        } as unknown as EnsureSalaryTaskForPeriodService;

        // Раздел 12 tasks.md (add-task-based-salary-rule) — erpData.taskCompletionStatuses
        // отдела: батч-запрос ОДИН раз на весь отдел (см. WHY в
        // GetDepartmentSalaryReportService), не по одному на сотрудника —
        // фикстуры этого файла без salaryTasks не содержат TaskCompletion-
        // правил, поэтому findManyByRulesAndPeriod вовсе не вызывается (см.
        // buildTaskCompletionStatuses).
        const findManyByRulesAndPeriod = jest
            .fn()
            .mockResolvedValue(overrides.salaryTasks ?? []);
        const taskRepo = {
            findByRuleAndPeriod: jest.fn(),
            findActiveForDirection: jest.fn(),
            insert: jest.fn(),
            save: jest.fn(),
            findManyByRulesAndPeriod,
            findActiveByRule: jest.fn(),
        } as unknown as SalaryTaskRepositoryPort;

        const service = new GetDepartmentSalaryReportService(
            dataSource,
            salesPerformanceReader,
            periodRepo,
            snapshotRepo,
            cacheRepo,
            domainSyncStatus,
            salesPlanRepo,
            salaryRulesResolver,
            ensureSalaryTask,
            taskRepo,
        );

        return {
            service,
            findServiceCompletedItems,
            findOrderPayedItems,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            findByEmployees,
            findForScope,
            findManyByKey,
            findManyByRulesAndPeriod,
        };
    };

    it('период открыт — считает по схеме, итог сотрудника и отдела складывается из fact/prognose правил', async () => {
        const employees = [{ id: 1, name: 'Иван Иванов' }];
        const schemas = [buildServiceSchema(1, 250)];
        const hoursByEmployee = new Map([[1, 8]]);

        const { service } = buildService({
            employees,
            schemas,
            hoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        expect(report.isClosed).toBe(false);
        expect(report.employees).toHaveLength(1);
        // 8 * 250 = 2000.
        expect(report.employees[0].total).toEqual({
            fact: 2000,
            prognose: 2000,
        });
        expect(report.employees[0].rules).toHaveLength(1);
        expect(report.total).toEqual({ fact: 2000, prognose: 2000 });
    });

    // docs/employee-ordering-and-salary-filter, Фаза 3, "не попадают ... в
    // списки, ни в расчёты, ни в итоговые суммы": сервис доверяет составу
    // отдела ServiceCalculationDataPort.findEmployeesInDepartment целиком —
    // сотрудник, которого там нет (в реальности отфильтрованный
    // isServiceAccount: true, см. WHY в ServiceCalculationDataRepository),
    // не попадает ни в employees[] ответа, ни в total, даже если у него есть
    // мотивационная схема отдела/личная.
    it('сотрудник, отсутствующий в составе отдела (служебный аккаунт), не попадает в отчёт и не входит в total', async () => {
        const employees = [{ id: 1, name: 'Иван Иванов' }];
        // Схема отдела применилась бы и к «служебному» id 2, если бы он
        // был в составе, — но findEmployeesInDepartment его не вернул.
        const schemas = [buildServiceSchema(1, 250)];
        const hoursByEmployee = new Map([
            [1, 8],
            [2, 100],
        ]);

        const { service } = buildService({
            employees,
            schemas,
            hoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        expect(report.employees.map((e) => e.employeeId)).toEqual([1]);
        expect(report.total).toEqual({ fact: 2000, prognose: 2000 });
    });

    it('расчёт отдела не порождает запросов к БД, пропорциональных числу сотрудников', async () => {
        const manyEmployees = Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            name: `Сотрудник ${i + 1}`,
        }));
        const schemas = manyEmployees.map((e) => buildServiceSchema(e.id, 100));

        const {
            service,
            findServiceCompletedItems,
            findOrderPayedItems,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            findByEmployees,
            findForScope,
            findManyByRulesAndPeriod,
        } = buildService({ employees: manyEmployees, schemas });

        await service.execute(1, '2026-08');

        // Общие ERP-данные, SalesPerformance и мотивационные схемы читаются
        // РОВНО ОДИН РАЗ на весь отдел, независимо от числа сотрудников.
        expect(findServiceCompletedItems).toHaveBeenCalledTimes(1);
        expect(findOrderPayedItems).toHaveBeenCalledTimes(1);
        expect(findEmployeeIdentitiesForEmployees).toHaveBeenCalledTimes(1);
        expect(findHoursWorkedForEmployees).toHaveBeenCalledTimes(1);
        expect(findByEmployees).toHaveBeenCalledTimes(1);
        expect(findForScope).toHaveBeenCalledTimes(1);
        // Раздел 12 tasks.md — фикстуры без TaskCompletion-правил, поэтому
        // batch-запрос статусов задач вовсе не должен произойти (см.
        // buildTaskCompletionStatuses).
        expect(findManyByRulesAndPeriod).not.toHaveBeenCalled();
    });

    // Раздел 12 tasks.md (add-task-based-salary-rule) — erpData.taskCompletionStatuses
    // отдела: та же гейтинг-логика видимости строки TaskCompletion
    // (design.md Decision 7), что и у отчёта сотрудника, но собранная одним
    // батч-запросом на весь отдел (см. WHY в GetDepartmentSalaryReportService).
    describe('правило TaskCompletion', () => {
        // buildBitrixTaskLink (раздел 7) читает портал из
        // process.env.BITRIX24_WEBHOOK_URL — не подгружается автоматически
        // для юнит-тестов (см. task-completion.entity.spec.ts).
        const originalWebhookUrl = process.env.BITRIX24_WEBHOOK_URL;

        beforeEach(() => {
            process.env.BITRIX24_WEBHOOK_URL =
                'https://irepair.bitrix24.ru/rest/12/8b659pktudu7xlqu/';
        });

        afterEach(() => {
            if (originalWebhookUrl === undefined) {
                delete process.env.BITRIX24_WEBHOOK_URL;
            } else {
                process.env.BITRIX24_WEBHOOK_URL = originalWebhookUrl;
            }
        });

        const buildTaskSchema = (employeeId: number) =>
            withRequestContext(() => {
                const rule = TaskCompletion.create({
                    type: 'TaskCompletion',
                    name: 'Сдать отчёт',
                    targetRole: 'ENGINEER',
                    config: {
                        bitrixTaskTitle: 'Сдать отчёт по браку',
                        isRecurring: true,
                        deadlineTemplate: '2026-08-05',
                        defaultAmount: 5000,
                    },
                });
                return {
                    schema: MotivationSchema.create({
                        targetType: 'Employee',
                        targetId: employeeId,
                        name: 'Задача',
                        rules: [rule],
                    }),
                    rule,
                };
            });

        it('задача выполнена — строка попадает в отчёт (amount из config.defaultAmount, requiresManualInput)', async () => {
            const employees = [{ id: 1, name: 'Иван Иванов' }];
            const { schema, rule } = buildTaskSchema(1);
            const task = SalaryTask.create({
                salaryRuleId: rule.id,
                period: '2026-08',
                deadline: new Date('2026-08-05T00:00:00.000Z'),
                isRecurring: true,
                bitrixTaskId: 'bx-1',
                taskStatus: TaskStatus.fromRaw('5'),
            });

            const { service, findManyByRulesAndPeriod } = buildService({
                employees,
                schemas: [schema],
                salaryTasks: [task],
            });

            const report = await service.execute(1, '2026-08');

            expect(findManyByRulesAndPeriod).toHaveBeenCalledWith(
                [rule.id],
                '2026-08',
            );
            expect(report.employees[0].rules).toHaveLength(1);
            expect(report.employees[0].rules[0]).toEqual(
                expect.objectContaining({
                    ruleId: rule.id,
                    amount: { fact: 5000, prognose: 5000 },
                }),
            );
        });

        it('задача ещё не выполнена — строка отсутствует в отчёте (FACT и PROGNOSE)', async () => {
            const employees = [{ id: 1, name: 'Иван Иванов' }];
            const { schema } = buildTaskSchema(1);

            const { service } = buildService({
                employees,
                schemas: [schema],
                salaryTasks: [],
            });

            const report = await service.execute(1, '2026-08');

            expect(report.employees[0].rules).toHaveLength(0);
            expect(report.employees[0].total).toEqual({
                fact: 0,
                prognose: 0,
            });
        });
    });

    it('период закрыт — верхнеуровневый isClosed=true, читает снапшот, поля prognose пустые', async () => {
        const employees = [{ id: 1, name: 'Иван Иванов' }];
        const serviceAccountingPeriod = buildClosedPeriod();
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

        const { service, findManyByKey } = buildService({
            employees,
            serviceAccountingPeriod,
            serviceSnapshots: serviceSnapshots as never,
        });

        const report = await service.execute(1, '2026-07');

        expect(findManyByKey).toHaveBeenCalledWith('service', '2026-07', [1]);
        expect(report.isClosed).toBe(true);
        expect(report.total).toEqual({ fact: 4000, prognose: null });
        expect(report.employees[0].total).toEqual({
            fact: 4000,
            prognose: null,
        });
        expect(report.employees[0].rules).toHaveLength(1);
        expect(
            report.employees[0].rules.every((r) => r.amount.prognose === null),
        ).toBe(true);
    });

    it('сотрудник без личной схемы получает нулевой вклад, не ломая расчёт остальных', async () => {
        const employees = [
            { id: 1, name: 'С личной схемой' },
            { id: 2, name: 'Без личной схемы' },
        ];
        const schemas = [buildServiceSchema(1, 250)];
        const hoursByEmployee = new Map([[1, 8]]);

        const { service } = buildService({
            employees,
            schemas,
            hoursByEmployee,
        });

        const report = await service.execute(1, '2026-08');

        const withSchema = report.employees.find((e) => e.employeeId === 1);
        const withoutSchema = report.employees.find((e) => e.employeeId === 2);

        expect(withSchema?.total).toEqual({ fact: 2000, prognose: 2000 });
        expect(withSchema?.rules).toHaveLength(1);
        expect(withoutSchema?.total).toEqual({ fact: 0, prognose: 0 });
        expect(withoutSchema?.rules).toHaveLength(0);
    });

    it('отдел без сотрудников отдаёт пустой список и нулевой итог', async () => {
        const { service } = buildService({ employees: [] });

        const report = await service.execute(999, '2026-08');

        expect(report.employees).toEqual([]);
        expect(report.total).toEqual({ fact: 0, prognose: 0 });
        expect(report.isClosed).toBe(false);
    });
});
