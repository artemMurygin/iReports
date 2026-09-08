import {
    EnsureShopSalaryTaskForPeriodService,
    filterRecurringTaskCompletionShopRules,
} from './ensure-salary-task-for-period.service';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import {
    ArgumentInvalidException,
    NotFoundException,
} from '@/shared/exceptions';
import type {
    ShopSalaryRule,
    TaskCompletionShopSalaryConfig,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { withRequestContext } from '@/shared/testing/with-request-context';

// openspec/changes/replace-bitrix-task-integration, design.md решение 4 —
// зеркало EnsureRuleTaskForPeriodService направления service (issue #57 —
// независимая копия), по прямому образцу EnsureSalesPlansForPeriodService.
// Юнит-тест на чистых in-memory фейках (ShopSalaryRuleRepositoryPort +
// CommandBus), без NestJS DI/БД.
describe('EnsureShopSalaryTaskForPeriodService', () => {
    // ShopSalaryRule — плоский duck-typed интерфейс (см. domain/types/
    // salary-rule.types.ts), реальный класс TaskCompletionShop не
    // обязателен для юнита самого ensure() — фейковый объект с нужным
    // config достаточен и читаемее двойного restore().
    const buildRuleFixture = (
        config: Partial<TaskCompletionShopSalaryConfig> = {},
    ): ShopSalaryRule => ({
        id: 'rule-1',
        name: 'Собрать отчёт',
        type: 'TaskCompletion',
        targetRole: 'OFFLINE_MANAGER',
        config: {
            taskIdByPeriod: {},
            taskTitleTemplate: 'Собрать отчёт по продажам',
            taskDescriptionTemplate: 'Описание задачи',
            isRecurring: true,
            deadlineTemplate: '2026-01-25T18:00:00.000Z',
            defaultAmount: 5000,
            ...config,
        },
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        calculate: () => null,
    });

    const buildService = (overrides?: {
        rule?: ShopSalaryRule | null;
        createdTaskId?: string;
    }) => {
        const findById = jest
            .fn<Promise<ShopSalaryRule | null>, [string]>()
            .mockResolvedValue(
                overrides?.rule === undefined
                    ? buildRuleFixture()
                    : overrides.rule,
            );
        const update = jest
            .fn<Promise<void>, [ShopSalaryRule]>()
            .mockResolvedValue(undefined);
        const ruleRepo: ShopSalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById,
            update,
        };

        const execute = jest
            .fn<Promise<{ id: string }>, [{ [key: string]: unknown }]>()
            .mockResolvedValue({
                id: overrides?.createdTaskId ?? 'task-99',
            });
        const commandBus = { execute };

        const service = new EnsureShopSalaryTaskForPeriodService(
            ruleRepo,
            commandBus as never,
        );

        return { service, findById, update, execute, ruleRepo };
    };

    it('идемпотентно: если taskId за период уже есть в taskIdByPeriod — возвращает его без обращения к CommandBus', async () => {
        const { service, execute, update } = buildService({
            rule: buildRuleFixture({
                taskIdByPeriod: { '2026-09': 'task-existing' },
            }),
        });

        const result = await service.ensure('rule-1', '2026-09', 42);

        expect(result).toBe('task-existing');
        expect(execute).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('разовое правило (isRecurring: false) без записи за период — не создаёт задачу, возвращает null', async () => {
        const { service, execute, update } = buildService({
            rule: buildRuleFixture({ isRecurring: false }),
        });

        const result = await service.ensure('rule-1', '2026-10', 42);

        expect(result).toBeNull();
        expect(execute).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('правило не найдено — бросает NotFoundException, не обращается к CommandBus', async () => {
        const { service, execute } = buildService({ rule: null });

        await expect(
            withRequestContext(() =>
                service.ensure('rule-unknown', '2026-10', 42),
            ),
        ).rejects.toThrow(NotFoundException);
        expect(execute).not.toHaveBeenCalled();
    });

    it('правило не TaskCompletion — бросает ArgumentInvalidException', async () => {
        const { service, execute } = buildService({
            rule: { ...buildRuleFixture(), type: 'PayPerHour' },
        });

        await expect(
            withRequestContext(() => service.ensure('rule-1', '2026-10', 42)),
        ).rejects.toThrow(ArgumentInvalidException);
        expect(execute).not.toHaveBeenCalled();
    });

    it('регулярное правило без записи за период — диспатчит CreateTaskCommand через CommandBus и сохраняет taskId в config.taskIdByPeriod', async () => {
        const { service, execute, update } = buildService({
            rule: buildRuleFixture({
                isRecurring: true,
                deadlineTemplate: '2026-01-25T18:00:00.000Z',
                taskTitleTemplate: 'Собрать отчёт по продажам',
                taskDescriptionTemplate: 'Описание задачи',
            }),
            createdTaskId: 'task-99',
        });

        const result = await withRequestContext(() =>
            service.ensure('rule-1', '2026-10', 77),
        );

        expect(execute).toHaveBeenCalledTimes(1);
        const dispatched = execute.mock.calls[0][0];
        expect(dispatched).toMatchObject({
            title: 'Собрать отчёт по продажам',
            description: 'Описание задачи',
            deadline: new Date('2026-10-25T18:00:00.000Z'),
            assigneeEmployeeId: 77,
            direction: 'shop',
        });
        expect(result).toBe('task-99');
        expect(update).toHaveBeenCalledTimes(1);
        const updatedRule = update.mock.calls[0][0];
        expect(updatedRule.id).toBe('rule-1');
        expect(
            (updatedRule.config as TaskCompletionShopSalaryConfig)
                .taskIdByPeriod,
        ).toEqual({ '2026-10': 'task-99' });
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

    const buildTaskRule = (isRecurring: boolean): ShopSalaryRule => ({
        id: isRecurring ? 'rule-recurring' : 'rule-once',
        name: isRecurring ? 'Задача (регулярная)' : 'Задача (разовая)',
        type: 'TaskCompletion',
        targetRole: 'OFFLINE_MANAGER',
        config: {
            taskIdByPeriod: {},
            taskTitleTemplate: 'Задача',
            isRecurring,
            deadlineTemplate: '2026-01-25T18:00:00.000Z',
            defaultAmount: 5000,
        },
        updatedAt: new Date(),
        calculate: () => null,
    });

    it('оставляет только регулярные TaskCompletion-правила', () => {
        const recurringTaskRule = buildTaskRule(true);
        const onceTaskRule = buildTaskRule(false);

        const result = filterRecurringTaskCompletionShopRules([
            otherRule,
            recurringTaskRule,
            onceTaskRule,
        ]);

        expect(result).toEqual([recurringTaskRule]);
    });
});
