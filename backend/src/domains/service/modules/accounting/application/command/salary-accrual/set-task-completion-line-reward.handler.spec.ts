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

    const build = (accrual: SalaryAccrual) => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        accrualRepo.store.set(accrual.id, accrual);
        const handler = new SetTaskCompletionLineRewardHandler(
            accrualRepo,
            fakeDirectoryRepo,
        );
        return { handler, accrualRepo };
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
});
