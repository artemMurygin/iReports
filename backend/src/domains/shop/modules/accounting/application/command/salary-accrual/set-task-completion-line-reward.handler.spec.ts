import { SetShopTaskCompletionLineRewardHandler } from './set-task-completion-line-reward.handler';
import { SetShopTaskCompletionLineRewardCommand } from './set-task-completion-line-reward.command';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import {
    ShopSalaryAccrualLineManualInputNotRequiredException,
    ShopSalaryAccrualLineNotDraftException,
    ShopSalaryAccrualNotFoundException,
} from '@/domains/shop/modules/accounting/domain/exceptions/salary-accrual.exception';
import { ArgumentNotProvidedException } from '@/shared/exceptions';
import { InMemoryShopSalaryAccrualRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Раздел 18 tasks.md (add-task-based-salary-rule) — зеркало раздела 13
// (SetTaskCompletionLineRewardHandler сервиса) для направления shop:
// первичный ввод суммы+комментария строки TaskCompletion (design.md
// Decision 5), по образцу AdjustShopSalaryAccrualLineHandler — БЕЗ
// UNIT_OF_WORK (одноагрегатное сохранение), без adjustedBy (первичный ввод,
// а не корректировка). В отличие от сервисного SetTaskCompletionLineRewardCommand
// команда не generic-по-direction — direction зафиксирован самим тем, что
// ShopSalaryAccrualRepositoryPort.findById уже фильтрует только 'shop'
// (см. domains/shop/CLAUDE.md).
//
// Группа 7 tasks.md (deactivate-one-off-task-completion-rule) — зеркало
// группы 6 (service): фиксация фактической суммы начисления по разовому
// правилу «за выполнение задачи» деактивирует это правило (design.md
// Decision 4, specs/shop/accounting/spec.md — Requirement «Разовое правило
// «за выполнение задачи» деактивируется по исходу задачи»).
describe('SetShopTaskCompletionLineRewardHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () => Promise.resolve([]),
    };

    const buildAccrual = (ruleId = 'rule-task-1') =>
        withRequestContext(() =>
            ShopSalaryAccrual.createFromSnapshot({
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 0,
                lines: [
                    {
                        ruleId,
                        type: 'TaskCompletion',
                        name: 'За выполнение задачи',
                        targetRole: 'ONLINE_MANAGER',
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

    // Разовое (isRecurring: false) правило TaskCompletion — минимально
    // необходимый config для FR из design.md Decision 4 (остальные поля
    // TaskCompletionShopSalaryConfig этому тесту не важны).
    const buildOneOffRule = (
        overrides: Partial<ShopSalaryRule> = {},
    ): ShopSalaryRule => {
        const deactivateMock = jest.fn(function (this: { isActive: boolean }) {
            this.isActive = false;
        });
        return {
            id: 'rule-task-1',
            name: 'За выполнение задачи',
            type: 'TaskCompletion',
            targetRole: 'ONLINE_MANAGER',
            config: {
                taskIdByPeriod: { '2026-07': 'task-1' },
                taskTitleTemplate: 'Собрать отчёт',
                isRecurring: false,
                deadlineTemplate: '2026-07-31T00:00:00.000Z',
                defaultAmount: 0,
                taskLinkTemplates: [],
                accountingPeriod: '2026-07',
            } as unknown as ShopSalaryRule['config'],
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

    const build = (
        accrual: ShopSalaryAccrual,
        rule: ShopSalaryRule | null = null,
    ) => {
        const accrualRepo = new InMemoryShopSalaryAccrualRepository();
        accrualRepo.store.set(accrual.id, accrual);
        const update = jest.fn().mockResolvedValue(undefined);
        const salaryRuleRepo: ShopSalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById: jest.fn().mockResolvedValue(rule),
            update,
            findByTaskId: jest.fn().mockResolvedValue(null),
            findOneOffByAnyTaskId: jest.fn().mockResolvedValue(null),
            findMotivationSchemaId: jest.fn().mockResolvedValue(null),
        };
        const handler = new SetShopTaskCompletionLineRewardHandler(
            accrualRepo,
            fakeDirectoryRepo,
            salaryRuleRepo,
        );
        return { handler, accrualRepo, salaryRuleRepo, update };
    };

    const command = (
        accrual: ShopSalaryAccrual,
        lineId: string,
        amount: number,
        comment: string,
    ) =>
        new SetShopTaskCompletionLineRewardCommand({
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

    it('сохраняет изменения через SHOP_SALARY_ACCRUAL_REPOSITORY (одноагрегатное сохранение)', async () => {
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
            ShopSalaryAccrual.createFromSnapshot({
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 2000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ONLINE_MANAGER',
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
            ).rejects.toThrow(
                ShopSalaryAccrualLineManualInputNotRequiredException,
            );
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
            ).rejects.toThrow(ShopSalaryAccrualLineNotDraftException);
        });
    });

    it('несуществующий документ → 404', async () => {
        const accrual = buildAccrual();
        const { handler } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(
                    new SetShopTaskCompletionLineRewardCommand({
                        accrualId: 'does-not-exist',
                        lineId: accrual.lines[0].id,
                        amount: 1000,
                        comment: 'Нет такого документа',
                    }),
                ),
            ).rejects.toThrow(ShopSalaryAccrualNotFoundException);
        });
    });

    // Группа 7 tasks.md — сценарий «Фиксация начисления деактивирует разовое
    // правило».
    it('фиксация начисления по активному разовому правилу деактивирует его и персистит', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const rule = buildOneOffRule();
        const { handler, salaryRuleRepo, update } = build(accrual, rule);

        await withRequestContext(() =>
            handler.execute(command(accrual, line.id, 5000, 'Задача выполнена')),
        );

        expect(rule.deactivate).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(rule);
        expect(salaryRuleRepo.findById).toHaveBeenCalledWith('rule-task-1');
    });

    // Сценарий «Успешное закрытие задачи само по себе не деактивирует
    // правило» покрыт группой 4/5 (TaskClosedEventHandler); здесь —
    // симметричный инвариант «регулярное правило не деактивируется
    // фиксацией начисления».
    it('фиксация начисления по регулярному правилу правило не деактивирует', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const rule = buildOneOffRule({
            config: {
                taskIdByPeriod: { '2026-07': 'task-1' },
                taskTitleTemplate: 'Собрать отчёт',
                isRecurring: true,
                deadlineTemplate: '2026-07-31T00:00:00.000Z',
                defaultAmount: 0,
                taskLinkTemplates: [],
                accountingPeriod: '2026-07',
            } as unknown as ShopSalaryRule['config'],
        });
        const { handler, update } = build(accrual, rule);

        await withRequestContext(() =>
            handler.execute(command(accrual, line.id, 5000, 'Задача выполнена')),
        );

        expect(rule.deactivate).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    // Сценарий «Уже неактивное правило повторно не деактивируется».
    it('фиксация начисления по уже неактивному разовому правилу его не трогает', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const rule = buildOneOffRule({ isActive: false });
        const { handler, update } = build(accrual, rule);

        await withRequestContext(() =>
            handler.execute(command(accrual, line.id, 5000, 'Задача выполнена')),
        );

        expect(rule.deactivate).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    // Правило не найдено (например, было удалено) — no-op, не должно валить
    // основную операцию фиксации начисления.
    it('правило не найдено по ruleId строки → не падает, не вызывает update', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, update } = build(accrual, null);

        const response = await withRequestContext(() =>
            handler.execute(command(accrual, line.id, 5000, 'Задача выполнена')),
        );

        expect(response.lines.find((item) => item.id === line.id)).toMatchObject(
            { amount: 5000 },
        );
        expect(update).not.toHaveBeenCalled();
    });
});
