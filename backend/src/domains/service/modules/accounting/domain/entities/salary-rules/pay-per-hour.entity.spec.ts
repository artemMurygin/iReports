import { PayPerHoursEntity } from './pay-per-hour.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';

// Юнит-тест на подготовленном объекте контекста — без поднятия БД и без
// моков репозиториев (см. docs/payroll/prd-payroll-calculation.md, Фаза 1).
const buildContext = (): CalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'service',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: undefined,
    salesPerformance: null,
});

describe('PayPerHoursEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом PayPerHour', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { hours: 10, price: 300 },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('PayPerHour');
            expect(rule.name).toBe('Почасовая ставка');
            expect(rule.targetRole).toBe('ENGINEER');
            expect(rule.config).toEqual({ hours: 10, price: 300 });
        });
    });

    describe('calculate', () => {
        it('умножает часы на ставку и возвращает строку расчёта', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { hours: 8, price: 250 },
            });

            const line = rule.calculate(buildContext());

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 8,
                rate: 250,
                amount: 2000,
                sources: [],
            });
        });

        it('возвращает сумму 0 при отсутствии часов', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });

            expect(rule.calculate(buildContext()).amount).toBe(0);
        });
    });
});
