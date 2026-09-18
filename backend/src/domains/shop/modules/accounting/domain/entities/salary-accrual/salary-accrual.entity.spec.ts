import { ShopSalaryAccrual } from './salary-accrual.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// FR3 of skip-zero-salary-accruals (зеркало кейсов FR1 для домена service,
// см. openspec/changes/skip-zero-salary-accruals/design.md, Decision 1/4):
// строка SalaryAccrualLine по правилу с рассчитанной суммой 0 не создаётся в
// документе начисления shop; фильтрация — в цикле построения lines внутри
// createFromSnapshot, а не в инварианте ShopSalaryAccrualLine.
describe('ShopSalaryAccrual.createFromSnapshot', () => {
    const line = (ruleId: string, amount: number) => ({
        ruleId,
        type: 'PayPerHour',
        name: 'Почасовая ставка',
        targetRole: 'ONLINE_MANAGER',
        quantity: 8,
        rate: amount / 8,
        amount,
        sources: [{ type: 'hours', id: 'h-1' }],
    });

    it('создаётся из строки снапшота в статусе DRAFT, строки повторяют снапшот, amount = originalAmount', () => {
        const accrual = withRequestContext(() =>
            ShopSalaryAccrual.createFromSnapshot({
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
        expect(accrual.direction).toBe('shop');
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

    // FR3: правило с рассчитанной суммой 0 не порождает строку в документе начисления
    it('правило с нулевой суммой не порождает строку начисления', () => {
        const accrual = withRequestContext(() =>
            ShopSalaryAccrual.createFromSnapshot({
                period: '2026-08',
                employeeId: 42,
                isDismissed: false,
                total: 2000,
                lines: [line('r1', 2000), line('r2', 0)],
            }),
        );

        expect(accrual.lines).toHaveLength(1);
        expect(accrual.lines[0].ruleId).toBe('r1');
        expect(accrual.lines[0].position).toBe(0);
    });

    // FR3: документ SalaryAccrual создаётся, даже если все правила сотрудника дали 0
    it('документ создаётся даже если все правила дали 0 — без единой строки', () => {
        const accrual = withRequestContext(() =>
            ShopSalaryAccrual.createFromSnapshot({
                period: '2026-08',
                employeeId: 7,
                isDismissed: false,
                total: 0,
                lines: [line('r1', 0), line('r2', 0)],
            }),
        );

        expect(accrual.total).toBe(0);
        expect(accrual.lines).toHaveLength(0);
    });

    // FR3: правило с ненулевой суммой по-прежнему создаёт строку
    it('правило с ненулевой суммой создаёт строку как прежде', () => {
        const accrual = withRequestContext(() =>
            ShopSalaryAccrual.createFromSnapshot({
                period: '2026-08',
                employeeId: 42,
                isDismissed: false,
                total: 1500,
                lines: [line('r1', 1500)],
            }),
        );

        expect(accrual.lines).toHaveLength(1);
        expect(accrual.lines[0]).toMatchObject({
            ruleId: 'r1',
            amount: 1500,
            originalAmount: 1500,
            status: 'DRAFT',
        });
    });

    it('отклоняет документ, сумма которого не равна сумме строк снапшота', () => {
        expect(() =>
            withRequestContext(() =>
                ShopSalaryAccrual.createFromSnapshot({
                    period: '2026-08',
                    employeeId: 42,
                    isDismissed: false,
                    total: 999,
                    lines: [line('r1', 2000)],
                }),
            ),
        ).toThrow(ArgumentInvalidException);
    });

    it('отклоняет некорректного сотрудника', () => {
        expect(() =>
            withRequestContext(() =>
                ShopSalaryAccrual.createFromSnapshot({
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
