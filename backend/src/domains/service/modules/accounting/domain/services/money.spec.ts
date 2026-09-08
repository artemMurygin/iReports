import { roundRubles } from './money';

describe('roundRubles', () => {
    it('округляет вверх при дробной части 0.5 и больше', () => {
        expect(roundRubles(149.5)).toBe(150);
        expect(roundRubles(149.85)).toBe(150);
    });

    it('округляет вниз при дробной части меньше 0.5', () => {
        expect(roundRubles(149.49)).toBe(149);
    });

    it('не меняет уже целое значение', () => {
        expect(roundRubles(100)).toBe(100);
    });
});
