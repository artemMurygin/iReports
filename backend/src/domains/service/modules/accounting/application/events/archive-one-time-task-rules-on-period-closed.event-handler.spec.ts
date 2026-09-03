import { ArchiveOneTimeTaskRulesOnPeriodClosedEventHandler } from './archive-one-time-task-rules-on-period-closed.event-handler';
import { AccountingPeriodClosedDomainEvent } from '@/domains/service/modules/accounting/domain/events/accounting-period-closed.domain-event';
import type { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import type { ResolvedEmployeeSalaryRules } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { ReopenAccountingPeriodHandler } from '@/domains/service/modules/accounting/application/command/reopen-accounting-period.handler';
import { ReopenAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/reopen-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';

const PERIOD = '2026-08';

// Регрессионный набор Фазы 1 docs/task-rule-archiving-and-links: закрытие
// периода архивирует разовые ACTIVE-правила, чей dueDate относится к этому
// периоду, — независимо от того, была задача выполнена в Bitrix24 или
// дедлайн прошёл без выполнения (сам обработчик не смотрит на статус
// задачи вовсе, только на dueDate/isRecurring/status правила, поэтому оба
// исхода в тестах ниже проверяют один и тот же путь, но с разным "следом"
// от реального выполнения — bitrixTaskIds/actualAmounts, как в реальном
// потоке).
const buildRule = (
    overrides: Partial<{ isRecurring: boolean; dueDate: string }> = {},
) =>
    withRequestContext(() =>
        TaskCompletedEntity.create({
            type: 'TaskCompleted',
            name: 'За задачу',
            targetRole: 'ENGINEER',
            config: {
                description: 'Сделать что-то важное',
                period: PERIOD,
                isRecurring: overrides.isRecurring ?? false,
                dueDate: overrides.dueDate ?? `${PERIOD}-15`,
                rewardAmount: 10000,
            },
        }),
    );

describe('ArchiveOneTimeTaskRulesOnPeriodClosedEventHandler', () => {
    const buildHandler = (
        rulesByEmployee: Map<number, ResolvedEmployeeSalaryRules>,
    ) => {
        const update = jest.fn().mockResolvedValue(undefined);
        const resolver = {
            forAllTargets: jest.fn().mockResolvedValue(rulesByEmployee),
        } as unknown as ResolveEmployeeSalaryRulesService;
        const repo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteAllByMotivationSchema: jest.fn(),
            findById: jest.fn(),
            update,
        };
        const handler = new ArchiveOneTimeTaskRulesOnPeriodClosedEventHandler(
            resolver,
            repo,
        );
        return { handler, update };
    };

    const buildEvent = () =>
        new AccountingPeriodClosedDomainEvent({
            aggregateId: 'period-1',
            direction: 'service',
            period: PERIOD,
            closedBy: 7,
            employeeCount: 1,
        });

    it('архивирует разовое ACTIVE правило, чья задача была выполнена в Bitrix24', async () => {
        await withRequestContext(async () => {
            const completedRule = buildRule();
            completedRule.addBitrixTaskId(101);
            completedRule.upsertActualAmount(PERIOD, 10000);

            const { handler, update } = buildHandler(
                new Map([
                    [1, { rules: [completedRule], schemasVersion: 'v1' }],
                ]),
            );

            await handler.handle(buildEvent());

            expect(completedRule.status).toBe('ARCHIVED');
            expect(update).toHaveBeenCalledWith(completedRule);
        });
    });

    it('архивирует разовое ACTIVE правило, чей дедлайн прошёл без выполнения', async () => {
        await withRequestContext(async () => {
            const overdueRule = buildRule();

            const { handler, update } = buildHandler(
                new Map([[1, { rules: [overdueRule], schemasVersion: 'v1' }]]),
            );

            await handler.handle(buildEvent());

            expect(overdueRule.status).toBe('ARCHIVED');
            expect(update).toHaveBeenCalledWith(overdueRule);
        });
    });

    it('не архивирует регулярное (isRecurring: true) правило', async () => {
        await withRequestContext(async () => {
            const recurringRule = buildRule({ isRecurring: true });

            const { handler, update } = buildHandler(
                new Map([
                    [1, { rules: [recurringRule], schemasVersion: 'v1' }],
                ]),
            );

            await handler.handle(buildEvent());

            expect(recurringRule.status).toBe('ACTIVE');
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('не архивирует правило, чей dueDate относится к другому периоду', async () => {
        await withRequestContext(async () => {
            const otherPeriodRule = buildRule({ dueDate: '2026-09-10' });

            const { handler, update } = buildHandler(
                new Map([
                    [1, { rules: [otherPeriodRule], schemasVersion: 'v1' }],
                ]),
            );

            await handler.handle(buildEvent());

            expect(otherPeriodRule.status).toBe('ACTIVE');
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('не трогает уже ARCHIVED правило повторно', async () => {
        await withRequestContext(async () => {
            const archivedRule = buildRule();
            archivedRule.archive();

            const { handler, update } = buildHandler(
                new Map([[1, { rules: [archivedRule], schemasVersion: 'v1' }]]),
            );

            await handler.handle(buildEvent());

            expect(update).not.toHaveBeenCalled();
        });
    });

    // docs/task-rule-archiving-and-links, PRD "Архив необратим": переоткрытие
    // периода не должно возвращать ранее заархивированное правило в ACTIVE.
    // ReopenAccountingPeriodHandler не имеет зависимости на
    // SalaryRuleRepositoryPort/ResolveEmployeeSalaryRulesService вовсе — он
    // просто не в состоянии тронуть статус правила, но тест фиксирует это
    // сквозным сценарием (закрытие → архивация → переоткрытие), а не
    // рассуждением об отсутствующих зависимостях.
    it('переоткрытие периода не возвращает заархивированное правило в ACTIVE', async () => {
        await withRequestContext(async () => {
            const rule = buildRule();
            const { handler: archiveHandler } = buildHandler(
                new Map([[1, { rules: [rule], schemasVersion: 'v1' }]]),
            );
            await archiveHandler.handle(buildEvent());
            expect(rule.status).toBe('ARCHIVED');

            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: PERIOD,
            });
            period.close(7, 1);

            const savePeriod = jest.fn().mockResolvedValue(undefined);
            const periodRepo: AccountingPeriodRepositoryPort = {
                findByDirectionAndPeriod: jest.fn().mockResolvedValue(period),
                save: savePeriod,
            };
            const deleteSnapshot = jest.fn().mockResolvedValue(undefined);
            const snapshotRepo: AccountingPeriodSnapshotPort = {
                saveAll: jest.fn(),
                findByKey: jest.fn(),
                findManyByKey: jest.fn().mockResolvedValue(new Map()),
                deleteByDirectionAndPeriod: deleteSnapshot,
            };
            const accrualRepo = new InMemorySalaryAccrualRepository();
            const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
            const reopenHandler = new ReopenAccountingPeriodHandler(
                periodRepo,
                snapshotRepo,
                accrualRepo,
                unitOfWork,
            );

            const response = await reopenHandler.execute(
                new ReopenAccountingPeriodCommand({
                    direction: 'service',
                    period: PERIOD,
                }),
            );

            expect(response.status).toBe('OPEN');
            expect(rule.status).toBe('ARCHIVED');
        });
    });
});
