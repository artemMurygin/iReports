import { PayPerHourShopEntity } from './pay-per-hour.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/shop-calculation-data.types';

// Юнит-тест на подготовленном объекте контекста — без БД и без моков
// репозиториев (issue #61).
const buildContext = (hoursWorked = 0): CalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'shop',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
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
        it('умножает часы из контекста (ручной ввод) на ставку', () => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'OFFLINE_MANAGER',
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
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'OFFLINE_MANAGER',
                config: { price: 250 },
            });

            expect(rule.calculate(buildContext()).amount).toBe(0);
        });

        it('округляет дробное произведение часов на ставку до целого рубля', () => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'OFFLINE_MANAGER',
                config: { price: 233 },
            });

            expect(rule.calculate(buildContext(2.5)).amount).toBe(
                Math.round(2.5 * 233),
            );
        });
    });
});
