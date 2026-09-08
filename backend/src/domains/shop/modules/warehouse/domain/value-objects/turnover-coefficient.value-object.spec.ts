import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { Money } from './money.value-object';
import { TurnoverCoefficient } from './turnover-coefficient.value-object';

describe('TurnoverCoefficient.calculate', () => {
    // FR: design.md D8 of shop-turnover-report — формула
    // turnoverSum / ((previousStockSum + currentStockSum) / 2).
    it('считает коэффициент по формуле turnoverSum / ((prevStockSum + currStockSum) / 2)', () => {
        const coefficient = TurnoverCoefficient.calculate(
            Money.ofKopecks(30000),
            Money.ofKopecks(10000),
            Money.ofKopecks(20000),
        );

        expect(coefficient.isAvailable()).toBe(true);
        // 30000 / ((10000 + 20000) / 2) = 30000 / 15000 = 2
        expect(coefficient.getValue()).toBe(2);
    });

    // FR: design.md D8 of shop-turnover-report — нет предыдущего периода
    // (первый месяц данных/новая категория) → isAvailable() === false, не 0.
    it('недоступен, если previousStockSum === null', () => {
        const coefficient = TurnoverCoefficient.calculate(
            Money.ofKopecks(30000),
            null,
            Money.ofKopecks(20000),
        );

        expect(coefficient.isAvailable()).toBe(false);
    });

    // FR: design.md D8/Risks of shop-turnover-report — оба остатка нулевые
    // → isAvailable() === false, без деления на ноль.
    it('недоступен, если оба остатка нулевые', () => {
        const coefficient = TurnoverCoefficient.calculate(
            Money.ofKopecks(0),
            Money.ofKopecks(0),
            Money.ofKopecks(0),
        );

        expect(coefficient.isAvailable()).toBe(false);
    });

    it('бросает исключение при обращении к значению недоступного коэффициента', () => {
        const coefficient = TurnoverCoefficient.calculate(
            Money.ofKopecks(30000),
            null,
            Money.ofKopecks(20000),
        );

        withRequestContext(() => {
            expect(() => coefficient.getValue()).toThrow(
                ArgumentInvalidException,
            );
        });
    });
});
