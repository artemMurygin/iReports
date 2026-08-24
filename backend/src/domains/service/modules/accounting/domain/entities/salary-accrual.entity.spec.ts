import { SalaryAccrual } from './salary-accrual.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import {
    SalaryAccrualNotAccruedException,
    SalaryAccrualNotPaidException,
} from '../exceptions/salary-accrual.exception';

describe('SalaryAccrual', () => {
    const line = (ruleId: string, amount: number) => ({
        ruleId,
        type: 'PayPerHour',
        name: 'Почасовая ставка',
        targetRole: 'ENGINEER',
        quantity: 8,
        rate: amount / 8,
        amount,
        sources: [{ type: 'hours', id: 'h-1' }],
    });

    it('создаётся из строки снапшота в статусе DRAFT, строки повторяют снапшот, amount = originalAmount', () => {
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-08',
                employeeId: 42,
                isDismissed: true,
                total: 3000,
                lines: [line('r1', 2000), line('r2', 1000)],
            }),
        );

        expect(accrual.status).toBe('DRAFT');
        expect(accrual.isDraft()).toBe(true);
        expect(accrual.isDismissed).toBe(true);
        expect(accrual.period).toBe('2026-08');
        expect(accrual.total).toBe(3000);
        expect(accrual.lines.map((l) => l.position)).toEqual([0, 1]);
        expect(accrual.lines[0]).toMatchObject({
            ruleId: 'r1',
            amount: 2000,
            originalAmount: 2000,
            status: 'DRAFT',
            sources: [{ type: 'hours', id: 'h-1' }],
        });
    });

    it('нулевой документ допустим (сотрудник с нулём по всем правилам)', () => {
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'shop',
                period: '2026-08',
                employeeId: 7,
                isDismissed: false,
                total: 0,
                lines: [line('r1', 0)],
            }),
        );
        expect(accrual.total).toBe(0);
        expect(accrual.lines).toHaveLength(1);
    });

    it('отклоняет документ, сумма которого не равна сумме строк снапшота', () => {
        expect(() =>
            withRequestContext(() =>
                SalaryAccrual.createFromSnapshot({
                    direction: 'service',
                    period: '2026-08',
                    employeeId: 42,
                    isDismissed: false,
                    total: 999,
                    lines: [line('r1', 2000)],
                }),
            ),
        ).toThrow(ArgumentInvalidException);
    });

    it('отклоняет некорректный период и сотрудника', () => {
        expect(() =>
            withRequestContext(() =>
                SalaryAccrual.createFromSnapshot({
                    direction: 'service',
                    period: '2026-13',
                    employeeId: 42,
                    isDismissed: false,
                    total: 0,
                    lines: [],
                }),
            ),
        ).toThrow(ArgumentInvalidException);
        expect(() =>
            withRequestContext(() =>
                SalaryAccrual.createFromSnapshot({
                    direction: 'service',
                    period: '2026-08',
                    employeeId: 0,
                    isDismissed: false,
                    total: 0,
                    lines: [],
                }),
            ),
        ).toThrow(ArgumentInvalidException);
    });

    // ========================== PAID (PRD 3, Фаза 12) ========================== //

    const accruedDocument = () => {
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-08',
                employeeId: 42,
                isDismissed: false,
                total: 3000,
                lines: [line('r1', 2000), line('r2', 1000)],
            }),
        );
        accrual.accrueLine(accrual.lines[0].id);
        accrual.accrueLine(accrual.lines[1].id);
        return accrual;
    };

    it('markPaid(): из ACCRUED — документ и все его строки переходят в PAID', () => {
        const accrual = accruedDocument();
        expect(accrual.status).toBe('ACCRUED');

        accrual.markPaid();

        expect(accrual.status).toBe('PAID');
        expect(accrual.isPaid()).toBe(true);
        expect(accrual.lines.every((l) => l.status === 'PAID')).toBe(true);
    });

    it('markPaid(): недостижим из DRAFT/PARTIALLY_ACCRUED — «пока остаток > 0, документ остаётся ACCRUED»', () => {
        const draft = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-08',
                employeeId: 42,
                isDismissed: false,
                total: 3000,
                lines: [line('r1', 2000), line('r2', 1000)],
            }),
        );
        expect(() => withRequestContext(() => draft.markPaid())).toThrow(
            SalaryAccrualNotAccruedException,
        );

        draft.accrueLine(draft.lines[0].id);
        expect(draft.status).toBe('PARTIALLY_ACCRUED');
        expect(() => withRequestContext(() => draft.markPaid())).toThrow(
            SalaryAccrualNotAccruedException,
        );
    });

    it('markPaid(): PAID уже не ACCRUED — повторный markPaid() отклонён', () => {
        const accrual = accruedDocument();
        accrual.markPaid();
        expect(() => withRequestContext(() => accrual.markPaid())).toThrow(
            SalaryAccrualNotAccruedException,
        );
    });

    it('revertToAccrued(): удаление выплаты возвращает PAID в ACCRUED вместе со строками', () => {
        const accrual = accruedDocument();
        accrual.markPaid();

        accrual.revertToAccrued();

        expect(accrual.status).toBe('ACCRUED');
        expect(accrual.lines.every((l) => l.status === 'ACCRUED')).toBe(true);
        // Документ снова доступен для действий над строками (ensureNotPaid
        // больше не блокирует).
        expect(() => accrual.unaccrueLine(accrual.lines[0].id)).not.toThrow();
    });

    it('revertToAccrued(): недостижим не из PAID', () => {
        const accrual = accruedDocument();
        expect(() =>
            withRequestContext(() => accrual.revertToAccrued()),
        ).toThrow(SalaryAccrualNotPaidException);
    });
});
