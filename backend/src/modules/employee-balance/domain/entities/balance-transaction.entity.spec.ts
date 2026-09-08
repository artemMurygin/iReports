import { BalanceTransaction } from './balance-transaction.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// BalanceTransaction.forPayout (PRD 3 docs/payroll-closing-and-accrual/
// prd-salary-payout-and-erp-cash-documents.md, Фаза 12): движение выплаты —
// всегда расход, amount > 0 на входе. createManual/forAccruedLine покрыты
// косвенно через create/delete-balance-transaction.handler.spec.ts —
// forPayout здесь отдельно, так как ни один существующий хендлер его ещё
// не вызывает (эндпоинт выплаты — следующие агенты Фазы 12).
describe('BalanceTransaction.forPayout', () => {
    it('создаёт движение PAYOUT: сумма хранится отрицательной, erpSyncRequired всегда true', () => {
        const payout = withRequestContext(() =>
            BalanceTransaction.forPayout({
                employeeId: 42,
                direction: 'service',
                amount: 5000,
                createdBy: 7,
                comment: 'Зарплата за июль',
            }),
        );

        expect(payout.type).toBe('PAYOUT');
        expect(payout.amount).toBe(-5000);
        expect(payout.employeeId).toBe(42);
        expect(payout.direction).toBe('service');
        expect(payout.createdBy).toBe(7);
        expect(payout.comment).toBe('Зарплата за июль');
        expect(payout.erpSyncRequired).toBe(true);
        // Выплата — не ручной тип (не входит в isManual()/MANUAL_TYPES):
        // прямой DELETE .../balance/transactions/:id её не удаляет — только
        // свой DELETE .../payout/:id (PRD 3).
        expect(payout.isManual()).toBe(false);
    });

    it('amount <= 0 отклоняется — «Создаётся на любую сумму amount > 0»', () => {
        expect(() =>
            withRequestContext(() =>
                BalanceTransaction.forPayout({
                    employeeId: 42,
                    direction: 'service',
                    amount: 0,
                    createdBy: 7,
                }),
            ),
        ).toThrow(ArgumentInvalidException);
        expect(() =>
            withRequestContext(() =>
                BalanceTransaction.forPayout({
                    employeeId: 42,
                    direction: 'service',
                    amount: -100,
                    createdBy: 7,
                }),
            ),
        ).toThrow(ArgumentInvalidException);
    });

    it('превышение остатка/выплата в направление shop — без доменных ограничений (проверка остатка — забота application-слоя)', () => {
        const payout = withRequestContext(() =>
            BalanceTransaction.forPayout({
                employeeId: 42,
                direction: 'shop',
                amount: 1_000_000,
                createdBy: 7,
            }),
        );
        expect(payout.amount).toBe(-1_000_000);
        expect(payout.direction).toBe('shop');
    });
});
