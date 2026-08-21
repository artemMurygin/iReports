import { PayPerHoursEntity } from './pay-per-hour.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';

// Юнит-тест на подготовленном объекте контекста — без поднятия БД и без
// моков репозиториев (см. docs/payroll/prd-payroll-calculation.md, Фаза 1).
// Источник часов — context.erpData.hoursWorked (с Фазы 5, сумма часов
// рабочих смен графика WorkScheduleEntry, см.
// docs/employee-work-schedule), а не config.hours; правило само не знает,
// откуда пришло число — 0 при отсутствии смен ничем не отличается от 0 при
// отсутствии старой ручной записи, поэтому тест ниже "нет записи о часах"
// покрывает и текущий источник.
const buildContext = (hoursWorked = 0): CalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'service',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: {
        serviceCompletedItems: [],
        hoursWorked,
    } satisfies ServiceCalculationErpData,
    salesPerformance: null,
});

describe('PayPerHoursEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом PayPerHour', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 300 },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('PayPerHour');
            expect(rule.name).toBe('Почасовая ставка');
            expect(rule.targetRole).toBe('ENGINEER');
            expect(rule.config).toEqual({ price: 300 });
        });
    });

    describe('calculate', () => {
        it('умножает часы из контекста на ставку и возвращает строку расчёта', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });

            const line = rule.calculate(buildContext(8));

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 8,
                rate: 250,
                amount: 2000,
                sources: [],
            });
        });

        it('возвращает сумму 0 при отсутствии записи о часах в контексте', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });

            expect(rule.calculate(buildContext()).amount).toBe(0);
        });

        it('округляет дробное произведение часов на ставку до целого рубля', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });

            // 2.5 * 250 = 625 — целое, проверим реальное дробление ставки.
            const ruleWithFraction = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 233 },
            });
            expect(ruleWithFraction.calculate(buildContext(2.5)).amount).toBe(
                Math.round(2.5 * 233),
            );
            expect(rule.calculate(buildContext(2.5)).amount).toBe(625);
        });
    });
});
