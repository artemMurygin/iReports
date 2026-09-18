import { SetTaskCompletionLineRewardHandler } from './set-task-completion-line-reward.handler';
import { SetTaskCompletionLineRewardCommand } from './set-task-completion-line-reward.command';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import {
    SalaryAccrualLineManualInputNotRequiredException,
    SalaryAccrualLineNotDraftException,
    SalaryAccrualNotFoundException,
} from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { ArgumentNotProvidedException } from '@/shared/exceptions';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Раздел 13 tasks.md (add-task-based-salary-rule) — первичный ручной ввод
// суммы+комментария строки TaskCompletion (design.md Decision 5), по образцу
// AdjustSalaryAccrualLineHandler, но БЕЗ UNIT_OF_WORK (одноагрегатное
// сохранение) и без adjustedBy (setTaskCompletionLineRewardRequestSchema —
// только amount/comment).
describe('SetTaskCompletionLineRewardHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () => Promise.resolve([]),
    };

    const buildAccrual = () =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 0,
                lines: [
                    {
                        ruleId: 'rule-task-1',
                        type: 'TaskCompletion',
                        name: 'За выполнение задачи',
                        targetRole: 'ENGINEER',
                        amount: 0,
                        sources: [
                            {
                                type: 'taskCompletion',
                                id: 'task-1',
                                label: 'Собрать отчёт',
                                link: 'https://portal.bitrix24.ru/.../task/view/1/',
                            },
                        ],
                        requiresManualInput: true,
                    },
                ],
            }),
        );

    // Правило TaskCompletion с id, совпадающим с ruleId строки из
    // buildAccrual() — так SetTaskCompletionLineRewardHandler находит его
    // через SALARY_RULE_REPOSITORY.findById(line.ruleId).
    const buildTaskCompletionRule = (
        isRecurring: boolean,
        isActive: boolean,
    ) => {
        const rule = new TaskCompletion({
            id: 'rule-task-1',
            props: {
                name: 'За выполнение задачи',
                type: 'TaskCompletion',
                targetRole: 'ENGINEER',
                config: {
                    taskIdByPeriod: { '2026-07': 'task-1' },
                    taskTitleTemplate: 'Собрать отчёт',
                    isRecurring,
                    deadlineTemplate: '2026-07-10',
                    defaultAmount: 5000,
                    taskLinkTemplates: [],
                    accountingPeriod: '2026-07',
                },
                isActive,
            },
        });
        return rule;
    };

    const fakeSalaryRuleRepo = (
        rule: SalaryRule | null = null,
    ): SalaryRuleRepositoryPort & { update: jest.Mock } => ({
        insert: jest.fn(),
        deleteByIds: jest.fn(),
        findById: jest.fn().mockResolvedValue(rule),
        update: jest.fn().mockResolvedValue(undefined),
        findByTaskId: jest.fn().mockResolvedValue(null),
        findOneOffByAnyTaskId: jest.fn().mockResolvedValue(null),
        findMotivationSchemaId: jest.fn().mockResolvedValue(null),
    });

    const build = (
        accrual: SalaryAccrual,
        salaryRuleRepo: SalaryRuleRepositoryPort = fakeSalaryRuleRepo(),
    ) => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        accrualRepo.store.set(accrual.id, accrual);
        const handler = new SetTaskCompletionLineRewardHandler(
            accrualRepo,
            fakeDirectoryRepo,
            salaryRuleRepo,
        );
        return { handler, accrualRepo, salaryRuleRepo };
    };

    const command = (
        accrual: SalaryAccrual,
        lineId: string,
        amount: number,
        comment: string,
    ) =>
        new SetTaskCompletionLineRewardCommand({
            direction: 'service',
            accrualId: accrual.id,
            lineId,
            amount,
            comment,
        });

    it('устанавливает сумму+комментарий строки, requiresManualInput сбрасывается в ответе', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler } = build(accrual);

        const response = await withRequestContext(() =>
            handler.execute(
                command(accrual, line.id, 5000, 'Задача выполнена, премия'),
            ),
        );

        const responseLine = response.lines.find((item) => item.id === line.id);
        expect(responseLine).toMatchObject({
            amount: 5000,
            originalAmount: 0,
            comment: 'Задача выполнена, премия',
            requiresManualInput: false,
            status: 'DRAFT',
        });
    });

    it('сохраняет изменения через SALARY_ACCRUAL_REPOSITORY (одноагрегатное сохранение)', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, accrualRepo } = build(accrual);

        await withRequestContext(() =>
            handler.execute(command(accrual, line.id, 3000, 'Готово')),
        );

        const saved = (await accrualRepo.findById(accrual.id))!;
        const savedLine = saved.lines.find((item) => item.id === line.id)!;
        expect(savedLine.amount).toBe(3000);
        expect(savedLine.comment).toBe('Готово');
        expect(savedLine.requiresManualInput).toBe(false);
    });

    it('без комментария (домен) → ArgumentNotProvidedException, не сохраняется', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, accrualRepo } = build(accrual);
        const save = jest.spyOn(accrualRepo, 'save');

        await withRequestContext(async () => {
            await expect(
                handler.execute(command(accrual, line.id, 5000, '   ')),
            ).rejects.toThrow(ArgumentNotProvidedException);
        });
        expect(save).not.toHaveBeenCalled();
    });

    it('строка не требует ручного ввода (не TaskCompletion) → конфликт', async () => {
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 2000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount: 2000,
                        sources: [],
                    },
                ],
            }),
        );
        const line = accrual.lines[0];
        const { handler } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(command(accrual, line.id, 1000, 'Комментарий')),
            ).rejects.toThrow(SalaryAccrualLineManualInputNotRequiredException);
        });
    });

    it('уже проведённая строка → конфликт', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        // Проведение строки с amount=0 (originalAmount=0) допустимо доменом.
        withRequestContext(() => accrual.accrueLine(line.id));
        const { handler } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(command(accrual, line.id, 1000, 'Поздно')),
            ).rejects.toThrow(SalaryAccrualLineNotDraftException);
        });
    });

    it('документ другого направления → 404', async () => {
        const accrual = buildAccrual();
        const { handler } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(
                    new SetTaskCompletionLineRewardCommand({
                        direction: 'shop',
                        accrualId: accrual.id,
                        lineId: accrual.lines[0].id,
                        amount: 1000,
                        comment: 'Не то направление',
                    }),
                ),
            ).rejects.toThrow(SalaryAccrualNotFoundException);
        });
    });

    // deactivate-one-off-task-completion-rule, design.md Decision 4 — spec:
    // service/accounting#requirement-разовое-правило-«за-выполнение-задачи»-деактивируется-по-исходу-задачи
    // (сценарий «Фиксация начисления деактивирует разовое правило»).
    it('фиксация начисления деактивирует активное разовое правило TaskCompletion', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const rule = buildTaskCompletionRule(false, true);
        const salaryRuleRepo = fakeSalaryRuleRepo(rule);
        const { handler } = build(accrual, salaryRuleRepo);

        await withRequestContext(() =>
            handler.execute(
                command(accrual, line.id, 5000, 'Задача выполнена, премия'),
            ),
        );

        expect(rule.isActive).toBe(false);
        expect(salaryRuleRepo.update).toHaveBeenCalledWith(rule);
    });

    // Сценарий «Регулярное правило не деактивируется…» — isRecurring: true
    // не затрагивается фиксацией начисления.
    it('фиксация начисления НЕ деактивирует регулярное правило TaskCompletion', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const rule = buildTaskCompletionRule(true, true);
        const salaryRuleRepo = fakeSalaryRuleRepo(rule);
        const { handler } = build(accrual, salaryRuleRepo);

        await withRequestContext(() =>
            handler.execute(command(accrual, line.id, 5000, 'Готово')),
        );

        expect(rule.isActive).toBe(true);
        expect(salaryRuleRepo.update).not.toHaveBeenCalled();
    });

    // Сценарий «Уже неактивное правило повторно не деактивируется».
    it('фиксация начисления НЕ трогает уже неактивное разовое правило', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const rule = buildTaskCompletionRule(false, false);
        const salaryRuleRepo = fakeSalaryRuleRepo(rule);
        const { handler } = build(accrual, salaryRuleRepo);

        await withRequestContext(() =>
            handler.execute(command(accrual, line.id, 5000, 'Готово')),
        );

        expect(rule.isActive).toBe(false);
        expect(salaryRuleRepo.update).not.toHaveBeenCalled();
    });
});
