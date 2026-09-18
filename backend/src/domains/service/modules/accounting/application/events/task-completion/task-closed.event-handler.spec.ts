import { Logger } from '@nestjs/common';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { TaskClosedEventHandler } from './task-closed.event-handler';
import { TaskClosedDomainEvent } from '@/modules/tasks/domain/events/task-closed.domain-event';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Группа 4 tasks.md (deactivate-one-off-task-completion-rule) —
// TaskClosedEventHandler направления service деактивирует разовое
// (isRecurring: false) правило TaskCompletion, когда связанная с ним задача
// закрывается со статусом CLOSED_UNSUCCESSFULLY (design.md Decision 2,
// specs/service/accounting/spec.md — Requirement «Разовое правило «за
// выполнение задачи» деактивируется по исходу задачи»). Зеркало
// domains/shop/modules/accounting'ного TaskClosedEventHandler (группа 5) —
// независимая реализация, тот же тестовый приём.
describe('TaskClosedEventHandler (service)', () => {
    // Минимально необходимый config для этого сценария — остальные поля
    // TaskCompletionSalaryConfig не важны (тот же приём, что в
    // set-task-completion-line-reward.handler.spec.ts).
    const buildRule = (overrides: Partial<SalaryRule> = {}): SalaryRule => {
        const deactivateMock = jest.fn(function (this: { isActive: boolean }) {
            this.isActive = false;
        });
        return {
            id: 'rule-task-1',
            name: 'За выполнение задачи',
            type: 'TaskCompletion',
            targetRole: 'ENGINEER',
            config: {
                taskIdByPeriod: { '2026-07': 'task-1' },
                taskTitleTemplate: 'Собрать отчёт',
                isRecurring: false,
                deadlineTemplate: '2026-07-31T00:00:00.000Z',
                defaultAmount: 0,
                taskLinkTemplates: [],
                accountingPeriod: '2026-07',
            } as unknown as SalaryRule['config'],
            updatedAt: new Date('2026-07-01T00:00:00.000Z'),
            isActive: true,
            calculate: () => null,
            deactivate: deactivateMock,
            activate: jest.fn(function (this: { isActive: boolean }) {
                this.isActive = true;
            }),
            ...overrides,
        };
    };

    const buildEvent = (
        status: 'CLOSED_SUCCESSFULLY' | 'CLOSED_UNSUCCESSFULLY',
        taskId = 'task-1',
    ) =>
        withRequestContext(
            () =>
                new TaskClosedDomainEvent({
                    aggregateId: taskId,
                    taskId,
                    status,
                }),
        );

    const build = (rule: SalaryRule | null) => {
        const update = jest.fn().mockResolvedValue(undefined);
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById: jest.fn(),
            update,
            findByTaskId: jest.fn(),
            findOneOffByAnyTaskId: jest.fn().mockResolvedValue(rule),
            findMotivationSchemaId: jest.fn(),
        };
        const handler = new TaskClosedEventHandler(salaryRuleRepo);
        return { handler, salaryRuleRepo, update };
    };

    it('неуспешное закрытие задачи деактивирует активное разовое правило', async () => {
        const rule = buildRule();
        const { handler, salaryRuleRepo, update } = build(rule);
        const event = buildEvent('CLOSED_UNSUCCESSFULLY');

        await handler.handle(event);

        expect(salaryRuleRepo.findOneOffByAnyTaskId).toHaveBeenCalledWith(
            'task-1',
        );
        expect(rule.deactivate).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(rule);
    });

    it('успешное закрытие задачи не деактивирует правило (no-op)', async () => {
        const rule = buildRule();
        const { handler, salaryRuleRepo, update } = build(rule);
        const event = buildEvent('CLOSED_SUCCESSFULLY');

        await handler.handle(event);

        expect(salaryRuleRepo.findOneOffByAnyTaskId).not.toHaveBeenCalled();
        expect(rule.deactivate).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('регулярное правило не деактивируется', async () => {
        // findOneOffByAnyTaskId сам фильтрует isRecurring === false (см.
        // SalaryRuleRepository), поэтому регулярное правило никогда не
        // возвращается этим методом — эмулируем это через null.
        const { handler, update } = build(null);
        const event = buildEvent('CLOSED_UNSUCCESSFULLY');

        await handler.handle(event);

        expect(update).not.toHaveBeenCalled();
    });

    it('правило не найдено (задача не привязана к правилу этого направления) → no-op', async () => {
        const { handler, salaryRuleRepo, update } = build(null);
        const event = buildEvent('CLOSED_UNSUCCESSFULLY');

        await handler.handle(event);

        expect(salaryRuleRepo.findOneOffByAnyTaskId).toHaveBeenCalledWith(
            'task-1',
        );
        expect(update).not.toHaveBeenCalled();
    });

    it('уже неактивное правило повторно не деактивируется', async () => {
        const rule = buildRule({ isActive: false });
        const { handler, update } = build(rule);
        const event = buildEvent('CLOSED_UNSUCCESSFULLY');

        await handler.handle(event);

        expect(rule.deactivate).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('ошибка репозитория логируется, не выбрасывается', async () => {
        const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            findByTaskId: jest.fn(),
            findOneOffByAnyTaskId: jest
                .fn()
                .mockRejectedValue(new Error('db unavailable')),
            findMotivationSchemaId: jest.fn(),
        };
        const handler = new TaskClosedEventHandler(salaryRuleRepo);
        const event = buildEvent('CLOSED_UNSUCCESSFULLY');

        await expect(handler.handle(event)).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledTimes(1);

        errorSpy.mockRestore();
    });
});
