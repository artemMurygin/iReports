import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { Money } from './money.value-object';

describe('Money (shop warehouse)', () => {
    // FR: money.value-object of shop-turnover-report — суммы оборота/остатка
    // хранятся в копейках, неотрицательным целым числом.
    it('создаётся из неотрицательного числа копеек', () => {
        const money = Money.ofKopecks(0);

        expect(money.getValue()).toBe(0);
    });

    it('создаётся из положительного числа копеек', () => {
        const money = Money.ofKopecks(15099);

        expect(money.getValue()).toBe(15099);
    });

    it('бросает исключение на отрицательное значение', () => {
        withRequestContext(() => {
            expect(() => Money.ofKopecks(-1)).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('бросает исключение на нецелое значение копеек', () => {
        withRequestContext(() => {
            expect(() => Money.ofKopecks(1.5)).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('сравнивается по значению, а не по идентичности', () => {
        expect(Money.ofKopecks(500).equals(Money.ofKopecks(500))).toBe(true);
        expect(Money.ofKopecks(500).equals(Money.ofKopecks(501))).toBe(false);
    });
});
