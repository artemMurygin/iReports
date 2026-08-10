import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalesFact } from './sales-fact.value-object';

describe('SalesFact', () => {
    describe('calculate', () => {
        it('считает margin, marginPercent, averageCheck и percentCompletion от исходных сумм', () => {
            const fact = SalesFact.calculate({
                turnover: 1_000_000,
                cost: 600_000,
                quantity: 50,
                planTurnover: 2_000_000,
            });

            expect(fact.getTurnover()).toBe(1_000_000);
            expect(fact.getCost()).toBe(600_000);
            expect(fact.getMargin()).toBe(400_000);
            expect(fact.getMarginPercent()).toBe(40);
            expect(fact.getQuantity()).toBe(50);
            expect(fact.getAverageCheck()).toBe(20_000);
            // 1_000_000 / 2_000_000 * 100
            expect(fact.getPercentCompletion()).toBe(50);
        });

        // План в статусе CREATED (в том числе PREVIOUS_MONTH/TEMPLATE, не
        // только APPROVED) полноценно участвует в расчёте процента
        // выполнения — SalesFact.calculate() не знает и не спрашивает про
        // статус плана, только его turnover (см. "Когда готово" Фазы 5).
        it('не зависит от статуса плана — использует plan.turnover как есть', () => {
            const fact = SalesFact.calculate({
                turnover: 300_000,
                cost: 100_000,
                quantity: 10,
                planTurnover: 1_000_000,
            });

            expect(fact.getPercentCompletion()).toBe(30);
        });

        it('изменение planTurnover меняет percentCompletion при неизменном факте', () => {
            const before = SalesFact.calculate({
                turnover: 500_000,
                cost: 200_000,
                quantity: 20,
                planTurnover: 1_000_000,
            });
            const after = SalesFact.calculate({
                turnover: 500_000,
                cost: 200_000,
                quantity: 20,
                planTurnover: 2_000_000,
            });

            expect(before.getPercentCompletion()).toBe(50);
            expect(after.getPercentCompletion()).toBe(25);
        });

        it('не делит на 0: нулевой оборот/план/количество дают нулевые производные поля', () => {
            const fact = SalesFact.calculate({
                turnover: 0,
                cost: 0,
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
                    SalesFact.calculate({
                        turnover: -1,
                        cost: 0,
                        quantity: 0,
                        planTurnover: 0,
                    }),
                ),
            ).toThrow();
        });

        it('отклоняет отрицательную себестоимость', () => {
            expect(() =>
                withRequestContext(() =>
                    SalesFact.calculate({
                        turnover: 0,
                        cost: -1,
                        quantity: 0,
                        planTurnover: 0,
                    }),
                ),
            ).toThrow();
        });

        it('отклоняет отрицательное количество', () => {
            expect(() =>
                withRequestContext(() =>
                    SalesFact.calculate({
                        turnover: 0,
                        cost: 0,
                        quantity: -1,
                        planTurnover: 0,
                    }),
                ),
            ).toThrow();
        });
    });
});
