import type { ManualBalanceTransactionType } from 'ireports-contracts';
import {
    ArgumentInvalidException,
    ArgumentNotProvidedException,
} from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { CreateBalanceTransactionHandler } from './create-balance-transaction.handler';
import { CreateBalanceTransactionCommand } from './create-balance-transaction.command';

// Ручные движения (PRD 2, Фаза 7): каждый тип, знак по типу (для
// ADJUSTMENT — явно), обязательный комментарий для PENALTY/ADJUSTMENT,
// дата задним числом, erpSyncRequired только хранится, минус без лимита.
describe('CreateBalanceTransactionHandler', () => {
    const build = () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const handler = new CreateBalanceTransactionHandler(transactionRepo);
        return { handler, transactionRepo };
    };

    const command = (
        overrides: Partial<{
            type: ManualBalanceTransactionType;
            amount: number;
            comment: string | undefined;
            occurredAt: Date | undefined;
            period: string | undefined;
            erpSyncRequired: boolean;
        }> = {},
    ) =>
        new CreateBalanceTransactionCommand({
            direction: 'service',
            employeeId: 42,
            type: overrides.type ?? 'ADVANCE',
            amount: overrides.amount ?? 5000,
            occurredAt: overrides.occurredAt,
            comment: overrides.comment,
            period: overrides.period,
            createdBy: 7,
            erpSyncRequired: overrides.erpSyncRequired ?? false,
        });

    it.each<[ManualBalanceTransactionType, number, number, string | undefined]>(
        [
            // тип, сумма в запросе (абсолютная), ожидаемая сумма в ленте
            ['ADVANCE', 5000, -5000, undefined],
            ['EXTRA_ADVANCE', 3000, -3000, undefined],
            ['PENALTY', 1000, -1000, 'Опоздание'],
            ['BONUS', 4000, 4000, undefined],
            ['SICK_LEAVE', 2500, 2500, undefined],
            ['VACATION_PAY', 6000, 6000, undefined],
        ],
    )(
        'создаёт движение %s: знак по типу, в ленте сумма %i → %i',
        async (type, amount, expected, comment) => {
            const { handler, transactionRepo } = build();

            const response = await withRequestContext(() =>
                handler.execute(command({ type, amount, comment })),
            );

            expect(response).toMatchObject({
                type,
                amount: expected,
                employeeId: 42,
                direction: 'service',
                createdBy: 7,
                erpSyncRequired: false,
                isReversed: false,
                accrualLine: null,
            });
            expect(transactionRepo.store.size).toBe(1);
        },
    );

    it('ADJUSTMENT: знак задаётся явно — и приход, и расход; нулевая сумма отклоняется', async () => {
        const { handler } = build();

        await withRequestContext(async () => {
            const positive = await handler.execute(
                command({
                    type: 'ADJUSTMENT',
                    amount: 700,
                    comment: 'Недоплата за июль',
                }),
            );
            expect(positive.amount).toBe(700);

            const negative = await handler.execute(
                command({
                    type: 'ADJUSTMENT',
                    amount: -300,
                    comment: 'Переплата за июль',
                }),
            );
            expect(negative.amount).toBe(-300);

            await expect(
                handler.execute(
                    command({
                        type: 'ADJUSTMENT',
                        amount: 0,
                        comment: 'Ноль',
                    }),
                ),
            ).rejects.toThrow(ArgumentInvalidException);
        });
    });

    it('PENALTY и ADJUSTMENT без комментария отклоняются (400), сторно-типа среди ручных нет', async () => {
        const { handler, transactionRepo } = build();

        await withRequestContext(async () => {
            await expect(
                handler.execute(command({ type: 'PENALTY', amount: 1000 })),
            ).rejects.toThrow(ArgumentNotProvidedException);
            await expect(
                handler.execute(
                    command({ type: 'PENALTY', amount: 1000, comment: '  ' }),
                ),
            ).rejects.toThrow(ArgumentNotProvidedException);
            await expect(
                handler.execute(command({ type: 'ADJUSTMENT', amount: 500 })),
            ).rejects.toThrow(ArgumentNotProvidedException);
        });
        expect(transactionRepo.store.size).toBe(0);
    });

    it('для типов со знаком по типу сумма в запросе — только положительная', async () => {
        const { handler } = build();

        await withRequestContext(async () => {
            await expect(
                handler.execute(command({ type: 'ADVANCE', amount: -5000 })),
            ).rejects.toThrow(ArgumentInvalidException);
            await expect(
                handler.execute(command({ type: 'BONUS', amount: 0 })),
            ).rejects.toThrow(ArgumentInvalidException);
        });
    });

    it('дата задним числом сохраняется как дата движения, createdAt остаётся датой записи; период и erpSyncRequired хранятся', async () => {
        const { handler, transactionRepo } = build();
        const backdated = new Date('2026-07-15T00:00:00.000Z');

        const response = await withRequestContext(() =>
            handler.execute(
                command({
                    occurredAt: backdated,
                    period: '2026-07',
                    erpSyncRequired: true,
                }),
            ),
        );

        expect(new Date(response.occurredAt)).toEqual(backdated);
        expect(new Date(response.createdAt).getTime()).toBeGreaterThan(
            backdated.getTime(),
        );
        expect(response.period).toBe('2026-07');
        // erpSyncRequired в этой итерации только хранится — никакой
        // интеграции с ERP не вызывается (репозиторий in-memory, любые
        // другие порты хендлеру даже не инжектируются).
        expect(response.erpSyncRequired).toBe(true);
        expect(transactionRepo.store.size).toBe(1);
    });

    it('лимитов на аванс нет: авансы при нулевом остатке уводят баланс в минус', async () => {
        const { handler, transactionRepo } = build();

        await withRequestContext(async () => {
            await handler.execute(command({ type: 'ADVANCE', amount: 5000 }));
            await handler.execute(
                command({ type: 'EXTRA_ADVANCE', amount: 2000 }),
            );
        });

        await expect(
            transactionRepo.sumByEmployee('service', 42),
        ).resolves.toBe(-7000);
    });
});
