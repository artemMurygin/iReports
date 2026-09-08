import { PayPerHoursEntity } from './pay-per-hour.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';

// Юнит-тест на подготовленном объекте контекста — без поднятия БД и без
// моков репозиториев (см. docs/payroll/prd-payroll-calculation.md, Фаза 1).
// Источник часов — context.erpData.hoursWorked (сумма часов рабочих смен
// графика с ролью дня из PayPerHoursEntity.ELIGIBLE_SCHEDULE_ROLES, см.
// ServiceCalculationDataRepository.findHoursWorked) — правило само не знает,
// откуда пришли числа и как разделены по ролям/датам, только выбирает
// fact/prognose по context.mode.
const buildContext = (
    hoursWorked: ServiceCalculationErpData['hoursWorked'],
    mode: CalculationContext['mode'] = 'FACT',
): CalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'service',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode,
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
        it('в режиме FACT умножает hoursWorked.fact на ставку', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ONLINE_MANAGER',
                config: { price: 250 },
            });

            const line = rule.calculate(
                buildContext({ fact: 8, prognose: 20 }, 'FACT'),
            );

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 8,
                rate: 250,
                amount: 2000,
                sources: [],
            });
        });

        it('в режиме PROGNOSE умножает hoursWorked.prognose на ставку, а не fact', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ONLINE_MANAGER',
                config: { price: 250 },
            });

            const line = rule.calculate(
                buildContext({ fact: 8, prognose: 20 }, 'PROGNOSE'),
            );

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 20,
                rate: 250,
                amount: 5000,
                sources: [],
            });
        });

        it('возвращает сумму 0 при отсутствии подходящих часов в контексте', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });

            expect(
                rule.calculate(buildContext({ fact: 0, prognose: 0 })).amount,
            ).toBe(0);
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
            expect(
                ruleWithFraction.calculate(
                    buildContext({ fact: 2.5, prognose: 2.5 }),
                ).amount,
            ).toBe(Math.round(2.5 * 233));
            expect(
                rule.calculate(buildContext({ fact: 2.5, prognose: 2.5 }))
                    .amount,
            ).toBe(625);
        });
    });
});
