import { buildRuleBreakdown } from './rule-breakdown.builder';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

describe('buildRuleBreakdown (shop)', () => {
    it('обогащает строку расчёта атрибутами правила по индексу', () => {
        const rule = PayPerHourShopEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ONLINE_MANAGER',
            config: { price: 250 },
        });
        const line = {
            ruleId: rule.id,
            quantity: 8,
            rate: 250,
            amount: 2000,
            sources: [{ type: 'demandPosition', id: 1 }],
        };

        const [breakdown] = buildRuleBreakdown([rule], [line]);

        expect(breakdown).toEqual({
            ruleId: rule.id,
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ONLINE_MANAGER',
            salaryBasis: undefined,
            quantity: 8,
            rate: 250,
            amount: 2000,
            sources: [{ type: 'demandPosition', id: 1 }],
        });
    });

    it('для пустого набора правил возвращает пустой список', () => {
        expect(buildRuleBreakdown([], [])).toEqual([]);
    });
});
