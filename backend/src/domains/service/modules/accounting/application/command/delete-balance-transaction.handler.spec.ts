import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import {
    BalanceTransactionNotDeletableException,
    BalanceTransactionNotFoundException,
} from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { DeleteBalanceTransactionHandler } from './delete-balance-transaction.handler';
import { DeleteBalanceTransactionCommand } from './delete-balance-transaction.command';

// Удаление ошибочного ручного движения (PRD 2, Фаза 8b): запись исчезает
// из ленты и остаток пересчитывается; удалять можно только ручные движения
// без документа ERP — движение начисления (409, отменяется на строке
// документа) и движение с erpSyncRequired (409, удаляется вместе с
// документом ERP в PRD 3) прямому DELETE недоступны.
describe('DeleteBalanceTransactionHandler', () => {
    const build = () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const handler = new DeleteBalanceTransactionHandler(transactionRepo);
        return { handler, transactionRepo };
    };

    const manual = (
        overrides: Partial<
            Parameters<typeof BalanceTransaction.createManual>[0]
        > = {},
    ) =>
        withRequestContext(() =>
            BalanceTransaction.createManual({
                employeeId: 42,
                direction: 'service',
                type: 'ADVANCE',
                amount: 4000,
                createdBy: 7,
                ...overrides,
            }),
        );

    it('удаляет ручное движение: запись исчезает из ленты, остаток пересчитан', async () => {
        const { handler, transactionRepo } = build();
        const advance = manual();
        const bonus = manual({ type: 'BONUS', amount: 1000 });
        await transactionRepo.insertMany([advance, bonus]);
        await expect(transactionRepo.sumByEmployee(42)).resolves.toBe(-3000);

        await withRequestContext(() =>
            handler.execute(
                new DeleteBalanceTransactionCommand({
                    transactionId: advance.id,
                }),
            ),
        );

        expect(transactionRepo.store.has(advance.id)).toBe(false);
        await expect(transactionRepo.sumByEmployee(42)).resolves.toBe(1000);
        // Повторный DELETE уже удалённого движения — 404: записи нет.
        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: advance.id,
                    }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotFoundException);
    });

    it('движение начисления прямым DELETE не удаляется — 409 (только «Отменить начисление» строки)', async () => {
        const { handler, transactionRepo } = build();
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
        const transactions = withRequestContext(() =>
            BalanceTransaction.forAccruedLine(accrual, accrual.lines[0], 7),
        );
        await transactionRepo.insertMany(transactions);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: transactions[0].id,
                    }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotDeletableException);
        expect(transactionRepo.store.has(transactions[0].id)).toBe(true);
    });

    it('движение с документом ERP (erpSyncRequired) не удаляется — 409 (удаление вместе с документом ERP — PRD 3)', async () => {
        const { handler, transactionRepo } = build();
        const erpAdvance = manual({ erpSyncRequired: true });
        await transactionRepo.insertMany([erpAdvance]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: erpAdvance.id,
                    }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotDeletableException);
        expect(transactionRepo.store.has(erpAdvance.id)).toBe(true);
    });

    it('несуществующее движение — 404', async () => {
        const { handler } = build();
        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: 'missing',
                    }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotFoundException);
    });
});
