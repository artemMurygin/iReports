import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import {
    BalanceTransactionAlreadyReversedException,
    BalanceTransactionNotFoundException,
    BalanceTransactionNotReversibleException,
} from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { ReverseBalanceTransactionHandler } from './reverse-balance-transaction.handler';
import { ReverseBalanceTransactionCommand } from './reverse-balance-transaction.command';

// Сторно (PRD 2, Фаза 7): MANUAL_REVERSAL — только для ручных движений без
// документа ERP; исходное движение остаётся в ленте с пометкой
// «сторнировано»; сумма сторно — точная противоположность; повторное
// сторно — 409 (гонку ловит уникальность reversedTransactionId).
describe('ReverseBalanceTransactionHandler', () => {
    const build = () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const handler = new ReverseBalanceTransactionHandler(transactionRepo);
        return { handler, transactionRepo };
    };

    const createAdvance = (
        transactionRepo: InMemoryBalanceTransactionRepository,
        erpSyncRequired = false,
    ) => {
        const advance = withRequestContext(() =>
            BalanceTransaction.createManual({
                employeeId: 42,
                direction: 'service',
                type: 'ADVANCE',
                amount: 5000,
                createdBy: 7,
                erpSyncRequired,
            }),
        );
        transactionRepo.store.set(advance.id, advance);
        return advance;
    };

    const command = (transactionId: string, comment = 'Ошибочный аванс') =>
        new ReverseBalanceTransactionCommand({
            direction: 'service',
            transactionId,
            comment,
            createdBy: 9,
        });

    it('сторнирует ручное движение: MANUAL_REVERSAL на противоположную сумму со ссылкой и комментарием, остаток восстановлен, исходное помечено', async () => {
        const { handler, transactionRepo } = build();
        const advance = createAdvance(transactionRepo);

        const response = await withRequestContext(() =>
            handler.execute(command(advance.id)),
        );

        expect(response).toMatchObject({
            type: 'MANUAL_REVERSAL',
            amount: 5000,
            employeeId: 42,
            direction: 'service',
            reversedTransactionId: advance.id,
            comment: 'Ошибочный аванс',
            createdBy: 9,
        });
        // Исходная запись осталась в ленте (сторно не удаляет), остаток —
        // сумма ленты — вернулся к нулю.
        expect(transactionRepo.store.size).toBe(2);
        await expect(
            transactionRepo.sumByEmployee('service', 42),
        ).resolves.toBe(0);
        // Признак «сторнировано» вычисляется по ссылке MANUAL_REVERSAL.
        await expect(
            transactionRepo.findReversedIds([advance.id]),
        ).resolves.toEqual(new Set([advance.id]));
    });

    it('повторное сторно того же движения — 409; гонка (прямой повтор мимо проверки) — тот же 409 от уникальности reversedTransactionId', async () => {
        const { handler, transactionRepo } = build();
        const advance = createAdvance(transactionRepo);

        await withRequestContext(async () => {
            await handler.execute(command(advance.id));
            await expect(handler.execute(command(advance.id))).rejects.toThrow(
                BalanceTransactionAlreadyReversedException,
            );

            // Гонка: второй запрос прошёл проверку до коммита первого —
            // вставку останавливает уникальное ограничение (эмулируется
            // in-memory репозиторием, Prisma мапит P2002 сюда же).
            jest.spyOn(transactionRepo, 'findReversedIds').mockResolvedValue(
                new Set(),
            );
            await expect(handler.execute(command(advance.id))).rejects.toThrow(
                BalanceTransactionAlreadyReversedException,
            );
        });
        expect(
            [...transactionRepo.store.values()].filter(
                (transaction) => transaction.type === 'MANUAL_REVERSAL',
            ),
        ).toHaveLength(1);
    });

    it('сторно движения начисления запрещено (только «Отменить начисление» на строке), сторно сторно — тоже', async () => {
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
        const [accrualTransaction] = withRequestContext(() =>
            BalanceTransaction.forAccruedLine(accrual, accrual.lines[0], 7),
        );
        transactionRepo.store.set(accrualTransaction.id, accrualTransaction);

        await withRequestContext(async () => {
            await expect(
                handler.execute(command(accrualTransaction.id)),
            ).rejects.toThrow(BalanceTransactionNotReversibleException);

            const advance = createAdvance(transactionRepo);
            const reversal = await handler.execute(command(advance.id));
            await expect(handler.execute(command(reversal.id))).rejects.toThrow(
                BalanceTransactionNotReversibleException,
            );
        });
    });

    it('движение с документом ERP (erpSyncRequired) не сторнируется — исправление удалением вместе с документом ERP (PRD 3)', async () => {
        const { handler, transactionRepo } = build();
        const erpAdvance = createAdvance(transactionRepo, true);

        await withRequestContext(() =>
            expect(handler.execute(command(erpAdvance.id))).rejects.toThrow(
                BalanceTransactionNotReversibleException,
            ),
        );
        expect(transactionRepo.store.size).toBe(1);
    });

    it('несуществующее движение и движение другого направления — 404', async () => {
        const { handler, transactionRepo } = build();
        const advance = createAdvance(transactionRepo);

        await withRequestContext(async () => {
            await expect(handler.execute(command('missing'))).rejects.toThrow(
                BalanceTransactionNotFoundException,
            );
            await expect(
                handler.execute(
                    new ReverseBalanceTransactionCommand({
                        direction: 'shop',
                        transactionId: advance.id,
                        comment: 'Не то направление',
                        createdBy: 9,
                    }),
                ),
            ).rejects.toThrow(BalanceTransactionNotFoundException);
        });
    });
});
