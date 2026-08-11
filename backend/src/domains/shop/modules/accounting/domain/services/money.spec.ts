import { roundRubles } from './money';

describe('roundRubles (shop)', () => {
    it('округляет математически (0.5 — в большую сторону)', () => {
        expect(roundRubles(100.4)).toBe(100);
        expect(roundRubles(100.5)).toBe(101);
        expect(roundRubles(100.51)).toBe(101);
    });
});
