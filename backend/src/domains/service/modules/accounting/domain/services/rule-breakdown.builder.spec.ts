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

    // spec: service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения
    it('пропускает правило, чья строка расчёта null — не вставляет пустую строку на его место', () => {
        const ruleA = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 250 },
        });
        const ruleB = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Задача без результата',
            targetRole: 'ENGINEER',
            config: { price: 0 },
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
