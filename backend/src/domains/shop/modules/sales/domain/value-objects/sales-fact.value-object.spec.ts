import { withRequestContext } from '@/shared/testing/with-request-context';
import { ShopSalesFact } from './sales-fact.value-object';

describe('ShopSalesFact', () => {
    describe('calculate', () => {
        // ⚠️ Ключевой тест Фазы 11 (issue #54/#56): margin — вход, а не
        // производная от turnover/cost. sum(turnover) - sum(cost) здесь
        // намеренно НЕ равен margin — это и проверяется.
        it('margin равен переданному значению (MoySkladDemandPosition.profit), а не turnover - cost', () => {
            const fact = ShopSalesFact.calculate({
                turnover: 1_000_000,
                cost: 600_000,
                margin: 350_000, // turnover - cost был бы 400_000
                quantity: 50,
                planTurnover: 2_000_000,
            });

            expect(fact.getMargin()).toBe(350_000);
            expect(fact.getMargin()).not.toBe(
                fact.getTurnover() - fact.getCost(),
            );
            expect(fact.getMarginPercent()).toBe(35);
        });

        it('считает marginPercent, averageCheck и percentCompletion от исходных сумм', () => {
            const fact = ShopSalesFact.calculate({
                turnover: 1_000_000,
                cost: 600_000,
                margin: 400_000,
                quantity: 50,
                planTurnover: 2_000_000,
            });

            expect(fact.getTurnover()).toBe(1_000_000);
            expect(fact.getCost()).toBe(600_000);
            expect(fact.getMarginPercent()).toBe(40);
            expect(fact.getQuantity()).toBe(50);
            expect(fact.getAverageCheck()).toBe(20_000);
            expect(fact.getPercentCompletion()).toBe(50);
        });

        // quantity — Float (товар весовой/дробный), в отличие от service.
        it('принимает дробный quantity', () => {
            const fact = ShopSalesFact.calculate({
                turnover: 10_000,
                cost: 6_000,
                margin: 3_500,
                quantity: 2.5,
                planTurnover: 20_000,
            });

            expect(fact.getQuantity()).toBe(2.5);
            expect(fact.getAverageCheck()).toBe(Math.round(10_000 / 2.5));
        });

        it('не делит на 0: нулевой оборот/план/количество дают нулевые производные поля', () => {
            const fact = ShopSalesFact.calculate({
                turnover: 0,
                cost: 0,
                margin: 0,
                quantity: 0,
                planTurnover: 0,
            });

            expect(fact.getMarginPercent()).toBe(0);
            expect(fact.getAverageCheck()).toBe(0);
            expect(fact.getPercentCompletion()).toBe(0);
        });

        it('отклоняет отрицательный оборот', () => {
            expect(() =>
                withRequestContext(() =>
                    ShopSalesFact.calculate({
                        turnover: -1,
                        cost: 0,
                        margin: 0,
                        quantity: 0,
                        planTurnover: 0,
                    }),
                ),
            ).toThrow();
        });

        it('отклоняет отрицательную себестоимость', () => {
            expect(() =>
                withRequestContext(() =>
                    ShopSalesFact.calculate({
                        turnover: 0,
                        cost: -1,
                        margin: 0,
                        quantity: 0,
                        planTurnover: 0,
                    }),
                ),
            ).toThrow();
        });

        it('отклоняет отрицательное количество', () => {
            expect(() =>
                withRequestContext(() =>
                    ShopSalesFact.calculate({
                        turnover: 0,
                        cost: 0,
                        margin: 0,
                        quantity: -1,
                        planTurnover: 0,
                    }),
                ),
            ).toThrow();
        });
    });
});
