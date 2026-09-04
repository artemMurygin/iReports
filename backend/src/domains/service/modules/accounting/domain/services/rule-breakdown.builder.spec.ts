import { buildRuleBreakdown } from './rule-breakdown.builder';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

describe('buildRuleBreakdown', () => {
    it('обогащает строку расчёта атрибутами правила по индексу', () => {
        const rule = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 250 },
        });
        const line = {
            ruleId: rule.id,
            quantity: 8,
            rate: 250,
            amount: 2000,
            sources: [{ type: 'order', id: 1 }],
        };

        const [breakdown] = buildRuleBreakdown([rule], [line]);

        expect(breakdown).toEqual({
            ruleId: rule.id,
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            salaryBasis: undefined,
            quantity: 8,
            rate: 250,
            amount: 2000,
            sources: [{ type: 'order', id: 1 }],
        });
    });

    it('для пустого набора правил возвращает пустой список', () => {
        expect(buildRuleBreakdown([], [])).toEqual([]);
    });
});
