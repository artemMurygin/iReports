import { withRequestContext } from '@/shared/testing/with-request-context';
import { ListUnclosedTaskRulesForPeriodService } from './list-unclosed-task-rules-for-period.service';
import { ResolveEmployeeSalaryRulesService } from './resolve-employee-salary-rules.service';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';
import type { BitrixTaskBatchItem } from '@/integrations/bitrix/bitrix-tasks.service';

describe('ListUnclosedTaskRulesForPeriodService', () => {
    const buildTaskSchema = (
        employeeId: number,
        taskIds: number[],
        name = 'Задача',
    ) =>
        withRequestContext(() => {
            const rule = TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name,
                targetRole: 'ENGINEER',
                config: {
                    description: 'Описание',
                    period: '2026-08',
                    isRecurring: false,
                    dueDate: '2026-08-20',
                    rewardAmount: 1000,
                    bitrixTaskIds: taskIds,
                },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: employeeId,
                name: 'Схема с задачей',
                rules: [rule],
            });
        });

    const buildService = (
        schemas: MotivationSchema[],
        batch: BitrixTaskBatchItem[],
    ) => {
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest
                .fn()
                .mockResolvedValue(
                    schemas.filter((s) => s.getProps().target.isEmployee()),
                ),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
            initializeName: jest.fn().mockResolvedValue(undefined),
        };
        const dataSource = {
            findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
            findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
        } as unknown as ServiceCalculationDataPort;
        const salaryRulesResolver = new ResolveEmployeeSalaryRulesService(
            motivationSchemaRepo,
            dataSource,
        );

        const getTasksBatch = jest
            .fn<Promise<BitrixTaskBatchItem[]>, [number[]]>()
            .mockResolvedValue(batch);
        const bitrixTasksService = {
            getTasksBatch,
        } as unknown as BitrixTasksService;

        const service = new ListUnclosedTaskRulesForPeriodService(
            salaryRulesResolver,
            bitrixTasksService,
        );

        return { service, getTasksBatch };
    };

    it('пустой набор правил-задач — не делает запрос к Bitrix24 и отдаёт пустой список', async () => {
        await withRequestContext(async () => {
            const { service, getTasksBatch } = buildService([], []);

            const result = await service.execute('2026-08');

            expect(result).toEqual([]);
            expect(getTasksBatch).not.toHaveBeenCalled();
        });
    });

    it('несколько правил у разных сотрудников — ровно один пакетный запрос статусов', async () => {
        await withRequestContext(async () => {
            const schemas = [
                buildTaskSchema(1, [101]),
                buildTaskSchema(2, [102]),
            ];
            const { service, getTasksBatch } = buildService(schemas, [
                { id: 101, isAvailable: true, status: '2', period: '2026-08' },
                { id: 102, isAvailable: true, status: '3', period: '2026-08' },
            ]);

            await service.execute('2026-08');

            expect(getTasksBatch).toHaveBeenCalledTimes(1);
            expect(getTasksBatch).toHaveBeenCalledWith([101, 102]);
        });
    });

    it('задача в статусе "Закрыта" за запрошенный период — не попадает в список', async () => {
        await withRequestContext(async () => {
            const schemas = [buildTaskSchema(1, [101])];
            const { service } = buildService(schemas, [
                { id: 101, isAvailable: true, status: '5', period: '2026-08' },
            ]);

            const result = await service.execute('2026-08');

            expect(result).toEqual([]);
        });
    });

    it('задача в работе за запрошенный период — попадает в список со своим статусом', async () => {
        await withRequestContext(async () => {
            const schemas = [buildTaskSchema(1, [101], 'Задача в работе')];
            const { service } = buildService(schemas, [
                { id: 101, isAvailable: true, status: '3', period: '2026-08' },
            ]);

            const result = await service.execute('2026-08');

            expect(result).toEqual([
                {
                    ruleId: schemas[0].getProps().rules[0].id,
                    employeeId: 1,
                    ruleName: 'Задача в работе',
                    bitrixTaskId: 101,
                    status: 'IN_PROGRESS',
                    isUnavailable: false,
                },
            ]);
        });
    });

    it('недоступная задача — попадает в список с isUnavailable: true, без status/bitrixTaskId', async () => {
        await withRequestContext(async () => {
            const schemas = [buildTaskSchema(1, [101], 'Недоступная')];
            const { service } = buildService(schemas, [
                { id: 101, isAvailable: false, status: null, period: null },
            ]);

            const result = await service.execute('2026-08');

            expect(result).toEqual([
                {
                    ruleId: schemas[0].getProps().rules[0].id,
                    employeeId: 1,
                    ruleName: 'Недоступная',
                    isUnavailable: true,
                },
            ]);
        });
    });

    it('задача перенесена на другой месяц (доступна, но период не совпадает) — не попадает в список', async () => {
        await withRequestContext(async () => {
            const schemas = [buildTaskSchema(1, [101], 'Перенесена')];
            const { service } = buildService(schemas, [
                { id: 101, isAvailable: true, status: '2', period: '2026-09' },
            ]);

            const result = await service.execute('2026-08');

            expect(result).toEqual([]);
        });
    });

    // docs/task-rule-archiving-and-links, Фаза 3 — bitrixTaskUrl должен
    // присутствовать для каждой доступной задачи списка (BITRIX24_WEBHOOK_URL
    // отсутствует в остальных тестах файла, поэтому buildBitrixTaskLink()
    // там молча возвращает undefined и toEqual его не замечает — здесь
    // проверяем явно настроенный webhook).
    describe('bitrixTaskUrl', () => {
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

        it('присутствует для доступной задачи, попавшей в список', async () => {
            await withRequestContext(async () => {
                const schemas = [buildTaskSchema(1, [101], 'Задача в работе')];
                const { service } = buildService(schemas, [
                    {
                        id: 101,
                        isAvailable: true,
                        status: '3',
                        period: '2026-08',
                    },
                ]);

                const result = await service.execute('2026-08');

                expect(result).toEqual([
                    expect.objectContaining({
                        bitrixTaskId: 101,
                        bitrixTaskUrl:
                            'https://portal.bitrix24.ru/company/personal/user/0/tasks/task/view/101/',
                    }),
                ]);
            });
        });

        it('отсутствует при isUnavailable: true — недоступной задаче ссылку строить не из чего', async () => {
            await withRequestContext(async () => {
                const schemas = [buildTaskSchema(1, [101], 'Недоступная')];
                const { service } = buildService(schemas, [
                    { id: 101, isAvailable: false, status: null, period: null },
                ]);

                const result = await service.execute('2026-08');

                expect(result).toEqual([
                    {
                        ruleId: schemas[0].getProps().rules[0].id,
                        employeeId: 1,
                        ruleName: 'Недоступная',
                        isUnavailable: true,
                    },
                ]);
                expect(result[0].bitrixTaskUrl).toBeUndefined();
            });
        });
    });
});
