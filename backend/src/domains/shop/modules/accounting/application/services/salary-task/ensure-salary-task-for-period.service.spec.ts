import {
    EnsureShopSalaryTaskForPeriodService,
    filterRecurringTaskCompletionShopRules,
} from './ensure-salary-task-for-period.service';
import type { ShopSalaryTaskRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { ShopTaskStatus } from '@/domains/shop/modules/accounting/domain/value-objects/task-status.value-object';
import { Period } from '@/shared/domain/period.value-object';
import {
    ArgumentInvalidException,
    NotFoundException,
} from '@/shared/exceptions';
import type {
    ShopSalaryRule,
    TaskCompletionShopSalaryConfig,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Раздел 16 tasks.md (add-task-based-salary-rule) — тест ДО реализации
// (TDD). Зеркало EnsureSalaryTaskForPeriodService направления service
// (раздел 11, issue #57 — независимая копия) по прямому образцу
// EnsureSalesPlansForPeriodService (design.md Decision 4). Юнит-тест на
// чистых in-memory фейках, без NestJS DI/БД — тот же стиль, что и у
// EnsureShopSalesPlansForPeriodService.spec.ts.
describe('EnsureShopSalaryTaskForPeriodService', () => {
    const buildTaskCompletionRule = (
        overrides: Partial<TaskCompletionShopSalaryConfig> = {},
    ): ShopSalaryRule => ({
        id: 'rule-1',
        name: 'Собрать отчёт',
        type: 'TaskCompletion',
        targetRole: 'OFFLINE_MANAGER',
        config: {
            bitrixTaskTitle: 'Собрать отчёт по продажам',
            taskDescription: 'Описание задачи',
            isRecurring: true,
            deadlineTemplate: '2026-01-25T18:00:00.000Z',
            defaultAmount: 5000,
            ...overrides,
        },
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        calculate: () => null,
    });

    const buildService = (overrides?: {
        existingTask?: ShopSalaryTask | null;
        rule?: ShopSalaryRule | null;
        createdBitrixTaskId?: string;
    }) => {
        const findByRuleAndPeriod = jest
            .fn<Promise<ShopSalaryTask | null>, [string, string]>()
            .mockResolvedValue(overrides?.existingTask ?? null);
        const insert = jest.fn().mockResolvedValue(undefined);
        const taskRepo: ShopSalaryTaskRepositoryPort = {
            findByRuleAndPeriod,
            findActiveForDirection: jest.fn().mockResolvedValue([]),
            insert,
            save: jest.fn(),
            findManyByRulesAndPeriod: jest.fn().mockResolvedValue([]),
            findActiveByRule: jest.fn().mockResolvedValue([]),
        };

        const findById = jest
            .fn<Promise<ShopSalaryRule | null>, [string]>()
            .mockResolvedValue(
                overrides?.rule === undefined
                    ? buildTaskCompletionRule()
                    : overrides.rule,
            );
        const ruleRepo: ShopSalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById,
            update: jest.fn(),
        };

        const createTask = jest
            .fn<Promise<{ bitrixTaskId: string }>, [unknown]>()
            .mockResolvedValue({
                bitrixTaskId: overrides?.createdBitrixTaskId ?? 'bx-task-99',
            });
        const gateway: BitrixTasksGatewayPort = {
            createTask,
            closeTask: jest.fn(),
            updateDeadline: jest.fn(),
        };

        const service = new EnsureShopSalaryTaskForPeriodService(
            taskRepo,
            gateway,
            ruleRepo,
        );

        return {
            service,
            findByRuleAndPeriod,
            insert,
            findById,
            createTask,
        };
    };

    it('идемпотентно: если задача за период уже есть — возвращает её без обращения к Bitrix24', async () => {
        const existingTask = ShopSalaryTask.create({
            salaryRuleId: 'rule-1',
            period: Period.create('2026-09'),
            deadline: new Date('2026-09-25T18:00:00.000Z'),
            isRecurring: true,
            bitrixTaskId: 'bx-existing',
            taskStatus: ShopTaskStatus.newlyCreated(),
        });
        const { service, findById, createTask, insert } = buildService({
            existingTask,
        });

        const result = await withRequestContext(() =>
            service.ensure('rule-1', '2026-09', 42),
        );

        expect(result).toBe(existingTask);
        expect(findById).not.toHaveBeenCalled();
        expect(createTask).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    it('разовое правило (isRecurring: false) — не создаёт задачу в новом периоде', async () => {
        const { service, createTask, insert } = buildService({
            rule: buildTaskCompletionRule({ isRecurring: false }),
        });

        const result = await withRequestContext(() =>
            service.ensure('rule-1', '2026-10', 42),
        );

        expect(result).toBeNull();
        expect(createTask).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    it('правило не найдено — бросает NotFoundException, не обращается к Bitrix24', async () => {
        const { service, createTask } = buildService({ rule: null });

        await expect(
            withRequestContext(() =>
                service.ensure('rule-unknown', '2026-10', 42),
            ),
        ).rejects.toThrow(NotFoundException);
        expect(createTask).not.toHaveBeenCalled();
    });

    it('правило не TaskCompletion — бросает ArgumentInvalidException', async () => {
        const { service, createTask } = buildService({
            rule: {
                ...buildTaskCompletionRule(),
                type: 'PayPerHour',
            },
        });

        await expect(
            withRequestContext(() => service.ensure('rule-1', '2026-10', 42)),
        ).rejects.toThrow(ArgumentInvalidException);
        expect(createTask).not.toHaveBeenCalled();
    });

    it('регулярное правило — вычисляет дедлайн из deadlineTemplate (число месяца) и создаёт задачу в Bitrix24', async () => {
        const { service, createTask, insert } = buildService({
            rule: buildTaskCompletionRule({
                isRecurring: true,
                deadlineTemplate: '2026-01-25T18:00:00.000Z',
                bitrixTaskTitle: 'Собрать отчёт по продажам',
                taskDescription: 'Описание задачи',
            }),
        });

        const result = await withRequestContext(() =>
            service.ensure('rule-1', '2026-10', 77),
        );

        expect(createTask).toHaveBeenCalledWith({
            responsibleBitrixUserId: 77,
            title: 'Собрать отчёт по продажам',
            description: 'Описание задачи',
            deadline: new Date('2026-10-25T18:00:00.000Z'),
        });
        expect(insert).toHaveBeenCalledTimes(1);
        expect(result).toBeInstanceOf(ShopSalaryTask);
        expect(result?.bitrixTaskId).toBe('bx-task-99');
        expect(result?.isRecurring).toBe(true);
        expect(result?.taskStatus.isDone()).toBe(false);
        expect(result?.period.getValue()).toBe('2026-10');
    });
});

describe('filterRecurringTaskCompletionShopRules', () => {
    const otherRule: ShopSalaryRule = {
        id: 'rule-other',
        name: 'Почасовая ставка',
        type: 'PayPerHour',
        targetRole: 'OFFLINE_MANAGER',
        config: { price: 100 },
        updatedAt: new Date(),
        calculate: () => null,
    };

    const recurringTaskRule: ShopSalaryRule = {
        id: 'rule-recurring',
        name: 'Задача (регулярная)',
        type: 'TaskCompletion',
        targetRole: 'OFFLINE_MANAGER',
        config: {
            bitrixTaskTitle: 'Задача',
            isRecurring: true,
            deadlineTemplate: '2026-01-25T18:00:00.000Z',
            defaultAmount: 5000,
        },
        updatedAt: new Date(),
        calculate: () => null,
    };

    const onceTaskRule: ShopSalaryRule = {
        id: 'rule-once',
        name: 'Задача (разовая)',
        type: 'TaskCompletion',
        targetRole: 'OFFLINE_MANAGER',
        config: {
            bitrixTaskTitle: 'Задача разовая',
            isRecurring: false,
            deadlineTemplate: '2026-01-25T18:00:00.000Z',
            defaultAmount: 5000,
        },
        updatedAt: new Date(),
        calculate: () => null,
    };

    it('оставляет только регулярные TaskCompletion-правила', () => {
        const result = filterRecurringTaskCompletionShopRules([
            otherRule,
            recurringTaskRule,
            onceTaskRule,
        ]);

        expect(result).toEqual([recurringTaskRule]);
    });
});
