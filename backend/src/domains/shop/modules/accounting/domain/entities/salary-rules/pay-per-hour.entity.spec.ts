import { PayPerHourShopEntity } from './pay-per-hour.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';

// Юнит-тест на подготовленном объекте контекста — без БД и без моков
// репозиториев (issue #61). hoursWorked несёт пару факт/прогноз — правило
// само не знает, откуда пришли числа, только выбирает нужное по
// context.mode (см. PayPerHourShopEntity.ELIGIBLE_SCHEDULE_ROLES,
// ShopCalculationDataRepository.findHoursWorked).
const buildContext = (
    hoursWorked: ShopCalculationErpData['hoursWorked'],
    mode: CalculationContext['mode'] = 'FACT',
): CalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'shop',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode,
    erpData: {
        hoursWorked,
    } satisfies ShopCalculationErpData,
    salesPerformance: null,
});

describe('PayPerHourShopEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом PayPerHour', () => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'OFFLINE_MANAGER',
                config: { price: 300 },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('PayPerHour');
            expect(rule.name).toBe('Почасовая ставка');
            expect(rule.targetRole).toBe('OFFLINE_MANAGER');
            expect(rule.config).toEqual({ price: 300 });
        });
    });

    describe('calculate', () => {
        it('в режиме FACT умножает hoursWorked.fact на ставку', () => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'OFFLINE_MANAGER',
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
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'OFFLINE_MANAGER',
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

        it('возвращает сумму 0 при отсутствии записи о часах в контексте', () => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'OFFLINE_MANAGER',
                config: { price: 250 },
            });

            expect(rule.calculate(buildContext(undefined)).amount).toBe(0);
        });

        it('округляет дробное произведение часов на ставку до целого рубля', () => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'OFFLINE_MANAGER',
                config: { price: 233 },
            });

            expect(
                rule.calculate(buildContext({ fact: 2.5, prognose: 2.5 }))
                    .amount,
            ).toBe(Math.round(2.5 * 233));
        });
    });
});
