// Интеграционный тест задачи 7.2 (change salary-rule-bitrix-task): GET
// схемы мотивации сотрудника с регулярным правилом-задачей лениво
// достраивает задачу Bitrix24 текущего месяца, а повторный GET за тот же
// месяц не создаёт вторую (design.md, Decision 5 — та же идемпотентность,
// что и у SalesPlanAutoCreationCron/ListSalesPlansService). В отличие от
// остальных юнит-тестов модуля, здесь EnsureTaskRulesOnReadService и
// EnsureBitrixTaskForPeriodService — НЕ замоканы, а собраны как настоящие
// классы поверх фейкового SalaryRuleRepositoryPort/BitrixTasksService —
// проверяется сквозной путь GetMotivationSchemaService.execute() →
// EnsureTaskRulesOnReadService.ensureAll() → EnsureBitrixTaskForPeriodService.ensure().
import { withRequestContext } from '@/shared/testing/with-request-context';
import { GetMotivationSchemaService } from './get-motivation-schema.service';
import { EnsureTaskRulesOnReadService } from './ensure-task-rules-on-read.service';
import { EnsureBitrixTaskForPeriodService } from './ensure-bitrix-task-for-period.service';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';
import type { BitrixTaskBatchItem } from '@/integrations/bitrix/bitrix-tasks.service';

describe('Ленивое достраивание задачи регулярного правила при повторном GET схемы (интеграция)', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('второй GET за тот же месяц не создаёт вторую задачу в Bitrix24', async () => {
        await withRequestContext(async () => {
            jest.useFakeTimers().setSystemTime(
                new Date('2026-09-15T00:00:00.000Z'),
            );

            const rule = TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name: 'Ежемесячный отчёт',
                targetRole: 'ENGINEER',
                config: {
                    description: 'Описание',
                    period: '2026-09',
                    isRecurring: true,
                    dueDate: '2026-09-20',
                    rewardAmount: 1000,
                    bitrixTaskIds: [],
                },
            });
            const schema = MotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад инженера',
                rules: [rule],
            });

            const update = jest
                .fn<Promise<void>, [SalaryRule]>()
                .mockResolvedValue(undefined);
            const salaryRuleRepo: SalaryRuleRepositoryPort = {
                insert: jest.fn(),
                deleteAllByMotivationSchema: jest.fn(),
                findById: jest.fn(),
                update,
            };

            let nextTaskId = 555;
            const createTask = jest
                .fn<Promise<number>, [unknown]>()
                .mockImplementation(() => Promise.resolve(nextTaskId++));
            const getTasksBatch = jest.fn<
                Promise<BitrixTaskBatchItem[]>,
                [number[]]
            >((taskIds) =>
                Promise.resolve(
                    taskIds.map((id) => ({
                        id,
                        isAvailable: true,
                        status: '2',
                        period: '2026-09',
                    })),
                ),
            );
            const bitrixTasksService = {
                createTask,
                getTasksBatch,
            } as unknown as BitrixTasksService;

            const ensureBitrixTask = new EnsureBitrixTaskForPeriodService(
                salaryRuleRepo,
                bitrixTasksService,
            );
            const ensureTaskRules = new EnsureTaskRulesOnReadService(
                ensureBitrixTask,
            );

            const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
                insert: jest.fn(),
                findByEmployee: jest.fn(),
                findByEmployees: jest.fn().mockResolvedValue([]),
                findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
                findByDepartment: jest.fn().mockResolvedValue(null),
                findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
                findIdByTarget: jest.fn().mockResolvedValue(null),
                // Тот же экземпляр schema возвращается на оба вызова —
                // мутация rule.addBitrixTaskId() из первого ensure() видна
                // второму вызову GetMotivationSchemaService.execute(), как
                // у настоящей БД (перечитанной по тому же id).
                findById: jest.fn().mockResolvedValue(schema),
                findAll: jest.fn().mockResolvedValue([]),
                update: jest.fn(),
                initializeName: jest.fn(),
            };
            const directoryRepo: DirectoryRepositoryPort = {
                findDepartments: jest.fn().mockResolvedValue([]),
                findEmployees: jest.fn().mockResolvedValue([
                    {
                        id: 42,
                        firstName: 'Иван',
                        lastName: 'Петров',
                        departmentId: 1,
                    },
                ]),
            };

            const service = new GetMotivationSchemaService(
                motivationSchemaRepo,
                directoryRepo,
                ensureTaskRules,
            );

            await service.execute(schema.id);
            expect(createTask).toHaveBeenCalledTimes(1);
            expect(rule.bitrixTaskIds).toEqual([555]);

            await service.execute(schema.id);
            expect(createTask).toHaveBeenCalledTimes(1);
            expect(rule.bitrixTaskIds).toEqual([555]);
        });
    });
});
