import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalesPlan } from './sales-plan.entity';

describe('SalesPlan', () => {
    const baseProps = {
        direction: 'service' as const,
        department: 1,
        period: '2026-08',
        turnover: 1_000_000,
        margin: 200_000,
        source: 'MANUAL' as const,
    };

    it('создаёт план в статусе CREATED', () => {
        const plan = withRequestContext(() => SalesPlan.create(baseProps));

        expect(plan.direction).toBe('service');
        expect(plan.department).toBe(1);
        expect(plan.category).toBeNull();
        expect(plan.period).toBe('2026-08');
        expect(plan.status).toBe('CREATED');
        expect(plan.source).toBe('MANUAL');
        expect(plan.approvedBy).toBeNull();
        expect(plan.approvedAt).toBeNull();
    });

    it('отклоняет отрицательный оборот', () => {
        expect(() =>
            withRequestContext(() =>
                SalesPlan.create({ ...baseProps, turnover: -1 }),
            ),
        ).toThrow();
    });

    it('отклоняет период не в формате YYYY-MM', () => {
        expect(() =>
            withRequestContext(() =>
                SalesPlan.create({ ...baseProps, period: '08-2026' }),
            ),
        ).toThrow();
    });

    it('approve() переводит план в APPROVED и фиксирует, кто и когда утвердил', () => {
        const plan = withRequestContext(() => SalesPlan.create(baseProps));

        withRequestContext(() => plan.approve(42));

        expect(plan.status).toBe('APPROVED');
        expect(plan.approvedBy).toBe(42);
        expect(plan.approvedAt).toBeInstanceOf(Date);
    });

    it('edit() переводит source в MANUAL и сбрасывает утверждённый статус', () => {
        const plan = withRequestContext(() =>
            SalesPlan.create({ ...baseProps, source: 'PREVIOUS_MONTH' }),
        );
        withRequestContext(() => plan.approve(42));
        expect(plan.status).toBe('APPROVED');

        withRequestContext(() => plan.edit({ turnover: 1_500_000 }));

        expect(plan.turnover).toBe(1_500_000);
        expect(plan.source).toBe('MANUAL');
        expect(plan.status).toBe('CREATED');
        expect(plan.approvedBy).toBeNull();
        expect(plan.approvedAt).toBeNull();
    });

    it('edit() правки строки в CREATED тоже переводит source в MANUAL', () => {
        const plan = withRequestContext(() =>
            SalesPlan.create({ ...baseProps, source: 'TEMPLATE' }),
        );

        withRequestContext(() => plan.edit({ margin: 300_000 }));

        expect(plan.margin).toBe(300_000);
        expect(plan.source).toBe('MANUAL');
        expect(plan.status).toBe('CREATED');
    });

    it('повторное approve() (переутверждение) идемпотентно обновляет утверждающего', () => {
        const plan = withRequestContext(() => SalesPlan.create(baseProps));

        withRequestContext(() => plan.approve(1));
        withRequestContext(() => plan.approve(2));

        expect(plan.status).toBe('APPROVED');
        expect(plan.approvedBy).toBe(2);
    });
});
