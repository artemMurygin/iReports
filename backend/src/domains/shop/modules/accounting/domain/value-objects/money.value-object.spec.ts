import { Money } from './money.value-object';

describe('Money (shop)', () => {
    it('округляет математически (0.5 — в большую сторону)', () => {
        expect(Money.roundRubles(100.4).getValue()).toBe(100);
        expect(Money.roundRubles(100.5).getValue()).toBe(101);
        expect(Money.roundRubles(100.51).getValue()).toBe(101);
    });
});
