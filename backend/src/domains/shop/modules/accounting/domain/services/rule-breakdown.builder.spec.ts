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

    // spec: shop/accounting — «строка отсутствует в отчёте, пока задача не
    // выполнена»: null-строка не превращается в запись с undefined-полями,
    // правило целиком пропускается, а не занимает место в результате.
    it('пропускает правило, чья строка расчёта null, не вставляя пустую запись на его место', () => {
        const ruleA = PayPerHourShopEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ONLINE_MANAGER',
            config: { price: 250 },
        });
        const ruleB = PayPerHourShopEntity.create({
            type: 'PayPerHour',
            name: 'Задача (ещё не выполнена)',
            targetRole: 'ONLINE_MANAGER',
            config: { price: 100 },
        });
        const lineA = {
            ruleId: ruleA.id,
            quantity: 8,
            rate: 250,
            amount: 2000,
            sources: [],
        };

        const breakdown = buildRuleBreakdown([ruleA, ruleB], [lineA, null]);

        expect(breakdown).toHaveLength(1);
        expect(breakdown[0].ruleId).toBe(ruleA.id);
    });
});
