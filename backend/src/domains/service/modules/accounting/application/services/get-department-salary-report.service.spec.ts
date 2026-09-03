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
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';
import type { EnsureTaskRulesOnReadService } from '@/domains/service/modules/accounting/application/services/ensure-task-rules-on-read.service';

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
        const salaryRulesResolver = new ResolveEmployeeSalaryRulesService(
            motivationSchemaRepo,
            dataSource,
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

        // Ни одна фикстура этого файла не заводит правил TaskCompleted —
        // getTasksBatch не должен вызываться вовсе (ids пуст, см.
        // fetchBitrixTaskStatuses), поэтому достаточно голого мока без
        // ожиданий на вызовы (используется отдельным юнит-тестом ниже).
        const getTasksBatch = jest.fn().mockResolvedValue([]);
        const bitrixTasksService = {
            getTasksBatch,
        } as unknown as BitrixTasksService;

        const ensureAll = jest.fn().mockResolvedValue(undefined);
        const ensureTaskRules = {
            ensureAll,
        } as unknown as EnsureTaskRulesOnReadService;

        const service = new GetDepartmentSalaryReportService(
            dataSource,
            salesPerformanceReader,
            periodRepo,
            snapshotRepo,
            cacheRepo,
            domainSyncStatus,
            salesPlanRepo,
            salaryRulesResolver,
            bitrixTasksService,
            ensureTaskRules,
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
            getTasksBatch,
            ensureAll,
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
            findConfirmedTaskCompletions,
            findEmployeeIdentitiesForEmployees,
            findHoursWorkedForEmployees,
            findByEmployees,
            findForScope,
        } = buildService({ employees: manyEmployees, schemas });

        await service.execute(1, '2026-08');

        // Общие ERP-данные, SalesPerformance и мотивационные схемы читаются
        // РОВНО ОДИН РАЗ на весь отдел, независимо от числа сотрудников.
        expect(findServiceCompletedItems).toHaveBeenCalledTimes(1);
        expect(findOrderPayedItems).toHaveBeenCalledTimes(1);
        expect(findConfirmedTaskCompletions).toHaveBeenCalledTimes(1);
        expect(findEmployeeIdentitiesForEmployees).toHaveBeenCalledTimes(1);
        expect(findHoursWorkedForEmployees).toHaveBeenCalledTimes(1);
        expect(findByEmployees).toHaveBeenCalledTimes(1);
        expect(findForScope).toHaveBeenCalledTimes(1);
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

    // docs/task-rule-archiving-and-links, Фаза 4 — та же логика, что и в
    // GetEmployeeSalaryReportService: bitrixTaskUrl строится из
    // line.bitrixTaskId, сохранённого в снапшоте на момент закрытия.
    describe('bitrixTaskUrl из снапшота закрытого периода (TaskCompleted)', () => {
        const ORIGINAL_WEBHOOK_URL = process.env.BITRIX24_WEBHOOK_URL;

        beforeEach(() => {
            process.env.BITRIX24_WEBHOOK_URL =
                'https://portal.bitrix24.ru/rest/1/xxx/';
        });

        afterEach(() => {
            if (ORIGINAL_WEBHOOK_URL === undefined) {
                delete process.env.BITRIX24_WEBHOOK_URL;
            } else {
                process.env.BITRIX24_WEBHOOK_URL = ORIGINAL_WEBHOOK_URL;
            }
        });

        it('строку с bitrixTaskId в снапшоте — отдаёт рабочую bitrixTaskUrl', async () => {
            const employees = [{ id: 1, name: 'Иван Иванов' }];
            const serviceAccountingPeriod = buildClosedPeriod();
            const serviceSnapshots = new Map([
                [
                    1,
                    {
                        employeeId: 1,
                        total: 10000,
                        lines: [
                            {
                                ruleId: 'r1',
                                type: 'TaskCompleted',
                                name: 'За задачу',
                                targetRole: 'ENGINEER' as const,
                                amount: 10000,
                                sources: [],
                                bitrixTaskId: 555,
                            },
                        ],
                    },
                ],
            ]);

            const { service } = buildService({
                employees,
                serviceAccountingPeriod,
                serviceSnapshots: serviceSnapshots as never,
            });

            const report = await service.execute(1, '2026-07');

            expect(report.employees[0].rules[0]).toMatchObject({
                ruleId: 'r1',
                bitrixTaskUrl:
                    'https://portal.bitrix24.ru/company/personal/user/0/tasks/task/view/555/',
            });
        });

        it('legacy-строку без bitrixTaskId в снапшоте — отдаёт отчёт без ссылки, без ошибок', async () => {
            const employees = [{ id: 1, name: 'Иван Иванов' }];
            const serviceAccountingPeriod = buildClosedPeriod();
            const serviceSnapshots = new Map([
                [
                    1,
                    {
                        employeeId: 1,
                        total: 10000,
                        lines: [
                            {
                                ruleId: 'r1',
                                type: 'TaskCompleted',
                                name: 'За задачу',
                                targetRole: 'ENGINEER' as const,
                                amount: 10000,
                                sources: [],
                            },
                        ],
                    },
                ],
            ]);

            const { service } = buildService({
                employees,
                serviceAccountingPeriod,
                serviceSnapshots: serviceSnapshots as never,
            });

            const report = await service.execute(1, '2026-07');

            expect(report.employees[0].rules[0].bitrixTaskUrl).toBeUndefined();
        });
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

    // spec.md, "Пакетный запрос статусов при большом числе правил-задач" —
    // сценарий явно называет и отчёт отдела: до 30 правил-задач, не более
    // одного пакетного запроса статусов задач в Bitrix24.
    it('несколько правил TaskCompleted у разных сотрудников отдела — ровно один вызов getTasksBatch на весь отдел', async () => {
        const employees = [
            { id: 1, name: 'Первый' },
            { id: 2, name: 'Второй' },
        ];
        const buildTaskSchema = (employeeId: number, taskId: number) =>
            withRequestContext(() => {
                const rule = TaskCompletedEntity.create({
                    type: 'TaskCompleted',
                    name: 'Задача',
                    targetRole: 'ENGINEER',
                    config: {
                        description: 'Описание',
                        period: '2026-08',
                        isRecurring: false,
                        dueDate: '2026-08-20',
                        rewardAmount: 1000,
                        bitrixTaskIds: [taskId],
                    },
                });
                return MotivationSchema.create({
                    targetType: 'Employee',
                    targetId: employeeId,
                    name: 'Схема с задачей',
                    rules: [rule],
                });
            });
        const schemas = [buildTaskSchema(1, 101), buildTaskSchema(2, 102)];

        const { service, getTasksBatch } = buildService({
            employees,
            schemas,
        });
        getTasksBatch.mockResolvedValue([
            { id: 101, isAvailable: true, status: '5', period: '2026-08' },
            { id: 102, isAvailable: true, status: '2', period: '2026-08' },
        ]);

        await service.execute(1, '2026-08');

        expect(getTasksBatch).toHaveBeenCalledTimes(1);
        expect(getTasksBatch).toHaveBeenCalledWith([101, 102]);
    });

    // Задача 7.2 change salary-rule-bitrix-task: ленивое достраивание
    // задач регулярных правил-задач — по одному вызову ensureAll на
    // сотрудника отдела, до чтения статусов у Bitrix24.
    it('открытый период — лениво достраивает задачи правил-задач для каждого сотрудника отдела', async () => {
        const employees = [
            { id: 1, name: 'Первый' },
            { id: 2, name: 'Второй' },
        ];
        const schemas = [
            buildServiceSchema(1, 250),
            buildServiceSchema(2, 250),
        ];

        const { service, ensureAll } = buildService({ employees, schemas });

        await service.execute(1, '2026-08');

        expect(ensureAll).toHaveBeenCalledTimes(2);
        expect(ensureAll).toHaveBeenCalledWith(expect.any(Array), 1, '2026-08');
        expect(ensureAll).toHaveBeenCalledWith(expect.any(Array), 2, '2026-08');
    });

    it('отдел без сотрудников отдаёт пустой список и нулевой итог', async () => {
        const { service } = buildService({ employees: [] });

        const report = await service.execute(999, '2026-08');

        expect(report.employees).toEqual([]);
        expect(report.total).toEqual({ fact: 0, prognose: 0 });
        expect(report.isClosed).toBe(false);
    });
});
