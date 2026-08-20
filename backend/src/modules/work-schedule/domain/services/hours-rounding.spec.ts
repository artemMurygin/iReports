import { roundHours } from './hours-rounding';

describe('roundHours', () => {
    it('гасит гипотетическую погрешность двоичного сложения Float (8.1 + 8.2) — защитный случай, часы смены сегодня всегда кратны 0,5', () => {
        const sum = 8.1 + 8.2; // 16.299999999999997 в IEEE 754

        expect(roundHours(sum)).toBe(16.3);
    });

    it('не трогает значения, уже кратные 0,1', () => {
        expect(roundHours(24)).toBe(24);
        expect(roundHours(7.5)).toBe(7.5);
    });

    it('округляет до одного знака после запятой', () => {
        expect(roundHours(1.234)).toBe(1.2);
        expect(roundHours(1.26)).toBe(1.3);
    });
});
