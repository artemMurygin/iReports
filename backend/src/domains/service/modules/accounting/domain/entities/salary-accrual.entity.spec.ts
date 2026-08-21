import { SalaryAccrual } from './salary-accrual.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

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
});
