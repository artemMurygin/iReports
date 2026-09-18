import { AccrueShopSalaryAccrualLineHandler } from './accrue-salary-accrual-line.handler';
import { AccrueShopSalaryAccrualLineCommand } from './accrue-salary-accrual-line.command';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import { InMemoryShopSalaryAccrualRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/modules/accounting/.../accrue-salary-accrual-line.handler.spec.ts —
// независимый хендлер направления shop.
//
// deactivate-one-off-task-completion-rule — spec:
// shop/accounting#requirement-разовое-правило-«за-выполнение-задачи»-деактивируется-по-исходу-задачи.
// Обычное «Начислить» тоже должно деактивировать разовое правило TaskCompletion,
// не только выделенный флоу «Указать сумму» (SetShopTaskCompletionLineRewardHandler) —
// деньги считаются начисленными в обоих случаях.
describe('AccrueShopSalaryAccrualLineHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () => Promise.resolve([]),
    };

    const buildAccrual = (type = 'PayPerHour') =>
        withRequestContext(() =>
            ShopSalaryAccrual.createFromSnapshot({
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 2000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type,
                        name: type === 'PayPerHour' ? 'Почасовая ставка' : 'За выполнение задачи',
                        targetRole: 'ONLINE_MANAGER',
                        amount: 2000,
                        sources: [],
                    },
                ],
            }),
        );

    const buildOneOffRule = (
        isRecurring: boolean,
        isActive: boolean,
    ): ShopSalaryRule => {
        const deactivateMock = jest.fn(function (this: { isActive: boolean }) {
            this.isActive = false;
        });
        return {
            id: 'rule-1',
            name: 'За выполнение задачи',
            type: 'TaskCompletion',
            targetRole: 'ONLINE_MANAGER',
            config: {
                taskIdByPeriod: { '2026-07': 'task-1' },
                taskTitleTemplate: 'Собрать отчёт',
                isRecurring,
                deadlineTemplate: '2026-07-31T00:00:00.000Z',
                defaultAmount: 0,
                taskLinkTemplates: [],
                accountingPeriod: '2026-07',
            } as unknown as ShopSalaryRule['config'],
            updatedAt: new Date('2026-07-01T00:00:00.000Z'),
            isActive,
            calculate: () => null,
            deactivate: deactivateMock,
            activate: jest.fn(function (this: { isActive: boolean }) {
                this.isActive = true;
            }),
        };
    };

    const fakeSalaryRuleRepo = (
        rule: ShopSalaryRule | null = null,
    ): ShopSalaryRuleRepositoryPort & { update: jest.Mock; findById: jest.Mock } => ({
        insert: jest.fn(),
        deleteByIds: jest.fn(),
        findById: jest.fn().mockResolvedValue(rule),
        update: jest.fn().mockResolvedValue(undefined),
        findByTaskId: jest.fn().mockResolvedValue(null),
        findOneOffByAnyTaskId: jest.fn().mockResolvedValue(null),
        findMotivationSchemaId: jest.fn().mockResolvedValue(null),
    });

    const build = (
        accrual: ShopSalaryAccrual,
        salaryRuleRepo: ShopSalaryRuleRepositoryPort = fakeSalaryRuleRepo(),
    ) => {
        const accrualRepo = new InMemoryShopSalaryAccrualRepository();
        accrualRepo.store.set(accrual.id, accrual);
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const handler = new AccrueShopSalaryAccrualLineHandler(
            accrualRepo,
            transactionRepo,
            fakeDirectoryRepo,
            unitOfWork,
            salaryRuleRepo,
        );
        return { handler, accrualRepo, transactionRepo, salaryRuleRepo };
    };

    const command = (accrual: ShopSalaryAccrual, lineId: string) =>
        new AccrueShopSalaryAccrualLineCommand({
            accrualId: accrual.id,
            lineId,
            accruedBy: 7,
        });

    it('проводит строку: движение SALARY_ACCRUAL, строка ACCRUED', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, transactionRepo } = build(accrual);

        const response = await withRequestContext(() =>
            handler.execute(command(accrual, line.id)),
        );

        expect([...transactionRepo.store.values()]).toHaveLength(1);
        expect(
            response.lines.find((item) => item.id === line.id)?.status,
        ).toBe('ACCRUED');
    });

    describe('деактивация разового правила TaskCompletion при обычном начислении', () => {
        it('активное разовое правило деактивируется при обычном «Начислить»', async () => {
            const accrual = buildAccrual('TaskCompletion');
            const rule = buildOneOffRule(false, true);
            const { handler, salaryRuleRepo } = build(
                accrual,
                fakeSalaryRuleRepo(rule),
            );

            await withRequestContext(() =>
                handler.execute(command(accrual, accrual.lines[0].id)),
            );

            expect(rule.isActive).toBe(false);
            expect(salaryRuleRepo.update).toHaveBeenCalledWith(rule);
        });

        it('регулярное правило не деактивируется', async () => {
            const accrual = buildAccrual('TaskCompletion');
            const rule = buildOneOffRule(true, true);
            const { handler, salaryRuleRepo } = build(
                accrual,
                fakeSalaryRuleRepo(rule),
            );

            await withRequestContext(() =>
                handler.execute(command(accrual, accrual.lines[0].id)),
            );

            expect(rule.isActive).toBe(true);
            expect(salaryRuleRepo.update).not.toHaveBeenCalled();
        });

        it('уже неактивное правило повторно не трогается', async () => {
            const accrual = buildAccrual('TaskCompletion');
            const rule = buildOneOffRule(false, false);
            const { handler, salaryRuleRepo } = build(
                accrual,
                fakeSalaryRuleRepo(rule),
            );

            await withRequestContext(() =>
                handler.execute(command(accrual, accrual.lines[0].id)),
            );

            expect(salaryRuleRepo.update).not.toHaveBeenCalled();
        });

        it('не-TaskCompletion строка не обращается к ShopSalaryRuleRepositoryPort', async () => {
            const accrual = buildAccrual('PayPerHour');
            const { handler, salaryRuleRepo } = build(accrual);

            await withRequestContext(() =>
                handler.execute(command(accrual, accrual.lines[0].id)),
            );

            expect(salaryRuleRepo.findById).not.toHaveBeenCalled();
        });
    });
});
