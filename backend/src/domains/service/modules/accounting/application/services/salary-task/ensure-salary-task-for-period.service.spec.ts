import { withRequestContext } from '@/shared/testing/with-request-context';
import { EnsureSalaryTaskForPeriodService } from './ensure-salary-task-for-period.service';
import type { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { NotFoundException } from '@/shared/exceptions';

// Раздел 11 tasks.md (add-task-based-salary-rule) — по прямому образцу
// EnsureSalesPlansForPeriodService.spec.ts (domains/service/modules/sales):
// имитирует БД в памяти через мок SalaryTaskRepositoryPort, чтобы проверять
// настоящее поведение идемпотентности (второй ensure() видит то, что
// реально вставил первый), а не то, что подложил тест руками.
describe('EnsureSalaryTaskForPeriodService', () => {
    const buildRule = (overrides?: {
        isRecurring?: boolean;
        deadlineTemplate?: string;
    }) =>
        TaskCompletion.create({
            type: 'TaskCompletion',
            name: 'Собрать отчёт по браку',
            targetRole: 'ENGINEER',
            config: {
                bitrixTaskTitle: 'Собрать отчёт по браку за месяц',
                taskDescription: 'Свериться с журналом брака',
                isRecurring: overrides?.isRecurring ?? true,
                deadlineTemplate: overrides?.deadlineTemplate ?? '2026-01-15',
                defaultAmount: 5000,
            },
        });

    const buildService = (existingTasks: SalaryTask[] = []) => {
        const store = new Map(
            existingTasks.map((task) => [
                `${task.salaryRuleId}:${task.period}`,
                task,
            ]),
        );
        const insert = jest.fn((entity: SalaryTask) => {
            store.set(`${entity.salaryRuleId}:${entity.period}`, entity);
            return Promise.resolve();
        });
        const taskRepo: SalaryTaskRepositoryPort = {
            findByRuleAndPeriod: (salaryRuleId, period) =>
                Promise.resolve(store.get(`${salaryRuleId}:${period}`) ?? null),
            findActiveForDirection: jest.fn().mockResolvedValue([]),
            insert,
            save: jest.fn(),
        };

        const createTask = jest
            .fn()
            .mockResolvedValue({ bitrixTaskId: 'bx-999' });
        const tasksGateway: BitrixTasksGatewayPort = {
            createTask,
            closeTask: jest.fn(),
            updateDeadline: jest.fn(),
        };

        return { taskRepo, tasksGateway, insert, createTask, store };
    };

    const buildRuleRepo = (rule: ReturnType<typeof buildRule> | null) => {
        const findById = jest.fn().mockResolvedValue(rule);
        const ruleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById,
            update: jest.fn(),
        };
        return { ruleRepo, findById };
    };

    it('возвращает уже существующую задачу без повторного создания в Bitrix24 (идемпотентность)', async () => {
        await withRequestContext(async () => {
            const rule = buildRule();
            const existing = SalaryTask.create({
                salaryRuleId: rule.id,
                period: '2026-09',
                deadline: new Date('2026-09-15T00:00:00.000Z'),
                isRecurring: true,
                bitrixTaskId: 'bx-1',
                taskStatus: TaskStatus.fromRaw('2'),
            });
            const { taskRepo, tasksGateway, insert, createTask } = buildService(
                [existing],
            );
            const { ruleRepo, findById } = buildRuleRepo(rule);
            const service = new EnsureSalaryTaskForPeriodService(
                taskRepo,
                tasksGateway,
                ruleRepo,
            );

            const result = await service.ensure(rule.id, '2026-09', 555);

            expect(result).toBe(existing);
            expect(createTask).not.toHaveBeenCalled();
            expect(insert).not.toHaveBeenCalled();
            // Не должен ходить за конфигом правила — идемпотентность
            // определяется наличием записи, а не типом/полями правила.
            expect(findById).not.toHaveBeenCalled();
        });
    });

    it('разовое правило: не создаёт задачу, если период не совпадает с периодом создания', async () => {
        await withRequestContext(async () => {
            const rule = buildRule({ isRecurring: false });
            const { taskRepo, tasksGateway, insert, createTask } = buildService(
                [],
            );
            const { ruleRepo } = buildRuleRepo(rule);
            const service = new EnsureSalaryTaskForPeriodService(
                taskRepo,
                tasksGateway,
                ruleRepo,
            );

            const result = await service.ensure(rule.id, '2026-10', 555);

            expect(result).toBeNull();
            expect(createTask).not.toHaveBeenCalled();
            expect(insert).not.toHaveBeenCalled();
        });
    });

    it('регулярное правило: вычисляет дедлайн нового периода из deadlineTemplate и создаёт задачу', async () => {
        await withRequestContext(async () => {
            const rule = buildRule({
                isRecurring: true,
                deadlineTemplate: '2026-01-15',
            });
            const { taskRepo, tasksGateway, insert, createTask, store } =
                buildService([]);
            const { ruleRepo } = buildRuleRepo(rule);
            const service = new EnsureSalaryTaskForPeriodService(
                taskRepo,
                tasksGateway,
                ruleRepo,
            );

            const result = await service.ensure(rule.id, '2026-09', 555);

            expect(createTask).toHaveBeenCalledWith({
                responsibleBitrixUserId: 555,
                title: 'Собрать отчёт по браку за месяц',
                description: 'Свериться с журналом брака',
                deadline: new Date('2026-09-15T00:00:00.000Z'),
            });
            expect(insert).toHaveBeenCalledTimes(1);
            expect(result).not.toBeNull();
            expect(result?.bitrixTaskId).toBe('bx-999');
            expect(result?.period).toBe('2026-09');
            expect(result?.deadline).toEqual(
                new Date('2026-09-15T00:00:00.000Z'),
            );
            expect(store.get(`${rule.id}:2026-09`)).toBe(result);
        });
    });

    it('регулярное правило: день дедлайна зажимается длиной короткого месяца (28/29 февраля)', async () => {
        await withRequestContext(async () => {
            const rule = buildRule({
                isRecurring: true,
                deadlineTemplate: '2026-01-31',
            });
            const { taskRepo, tasksGateway, createTask } = buildService([]);
            const { ruleRepo } = buildRuleRepo(rule);
            const service = new EnsureSalaryTaskForPeriodService(
                taskRepo,
                tasksGateway,
                ruleRepo,
            );

            await service.ensure(rule.id, '2026-02', 555);

            expect(createTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    deadline: new Date('2026-02-28T00:00:00.000Z'),
                }),
            );
        });
    });

    it('бросает NotFoundException, если правило не найдено', async () => {
        await withRequestContext(async () => {
            const { taskRepo, tasksGateway } = buildService([]);
            const { ruleRepo } = buildRuleRepo(null);
            const service = new EnsureSalaryTaskForPeriodService(
                taskRepo,
                tasksGateway,
                ruleRepo,
            );

            await expect(
                service.ensure('missing-rule-id', '2026-09', 555),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
