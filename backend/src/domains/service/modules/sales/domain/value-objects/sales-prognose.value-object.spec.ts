import { Period } from '@/shared/domain/period.value-object';
import { SalesFact } from './sales-fact.value-object';
import { SalesPrognose } from './sales-prognose.value-object';

describe('SalesPrognose', () => {
    const period = Period.create('2026-08'); // 31 календарный день

    it('линейно экстраполирует turnover/margin/quantity по прошедшим дням месяца', () => {
        const fact = SalesFact.calculate({
            turnover: 500_000,
            cost: 300_000,
            quantity: 10,
            planTurnover: 2_000_000,
        });
        // Половина месяца (2026-08-16T00:00Z) — ровно 15 прошедших дней.
        const now = new Date('2026-08-16T00:00:00.000Z');

        const prognose = SalesPrognose.forPeriod(fact, period, 2_000_000, now);

        // factor = 31 / 15
        expect(prognose.getTurnover()).toBe(Math.round((500_000 * 31) / 15));
        expect(prognose.getMargin()).toBe(Math.round((200_000 * 31) / 15));
        expect(prognose.getQuantity()).toBe(Math.round((10 * 31) / 15));
    });

    it('marginPercent и percentCompletion пересчитываются из экстраполированных сумм, а не экстраполируются напрямую', () => {
        const fact = SalesFact.calculate({
            turnover: 500_000,
            cost: 300_000, // marginPercent факта = 40%
            quantity: 10,
            planTurnover: 2_000_000,
        });
        const now = new Date('2026-08-16T00:00:00.000Z');

        const prognose = SalesPrognose.forPeriod(fact, period, 2_000_000, now);

        expect(prognose.getMarginPercent()).toBe(
            Math.round(
                (prognose.getMargin() / prognose.getTurnover()) * 10000,
            ) / 100,
        );
        expect(prognose.getPercentCompletion()).toBe(
            Math.round((prognose.getTurnover() / 2_000_000) * 10000) / 100,
        );
    });

    it('прогноз выше факта, когда план по обороту растёт быстрее прошедшей доли месяца', () => {
        const fact = SalesFact.calculate({
            turnover: 100_000,
            cost: 50_000,
            quantity: 5,
            planTurnover: 1_000_000,
        });
        const now = new Date('2026-08-06T00:00:00.000Z'); // 5 прошедших дней

        const prognose = SalesPrognose.forPeriod(fact, period, 1_000_000, now);

        expect(prognose.getTurnover()).toBeGreaterThan(fact.getTurnover());
    });

    // Решение зафиксировано: день не считается прошедшим до его окончания,
    // поэтому в первую минуту месяца прошедших дней ещё 0 — экстраполировать
    // нечего, прогноз равен факту (нулевому).
    it('в первую минуту месяца (elapsedDays = 0) прогноз равен факту', () => {
        const fact = SalesFact.calculate({
            turnover: 0,
            cost: 0,
            quantity: 0,
            planTurnover: 1_000_000,
        });
        const now = new Date('2026-08-01T00:00:00.000Z');

        const prognose = SalesPrognose.forPeriod(fact, period, 1_000_000, now);

        expect(prognose.getTurnover()).toBe(0);
        expect(prognose.getMargin()).toBe(0);
        expect(prognose.getQuantity()).toBe(0);
    });

    // Если период уже закрыт или полностью в прошлом (now на или после
    // конца периода) — все календарные дни уже прошли, экстраполировать
    // нечего: прогноз = факту месяца (см. Фаза 5, "Когда готово").
    it('для периода, полностью лежащего в прошлом, прогноз равен факту месяца', () => {
        const fact = SalesFact.calculate({
            turnover: 1_234_000,
            cost: 700_000,
            quantity: 42,
            planTurnover: 2_000_000,
        });
        const now = new Date('2026-12-01T00:00:00.000Z');

        const prognose = SalesPrognose.forPeriod(fact, period, 2_000_000, now);

        expect(prognose.getTurnover()).toBe(fact.getTurnover());
        expect(prognose.getMargin()).toBe(fact.getMargin());
        expect(prognose.getQuantity()).toBe(fact.getQuantity());
        expect(prognose.getMarginPercent()).toBe(fact.getMarginPercent());
        expect(prognose.getPercentCompletion()).toBe(
            fact.getPercentCompletion(),
        );
    });

    it('последний день месяца ещё не завершился (23:59:59.999) — он ещё не считается прошедшим, прогноз чуть выше факта', () => {
        const fact = SalesFact.calculate({
            turnover: 2_100_000,
            cost: 1_000_000,
            quantity: 60,
            planTurnover: 2_000_000,
        });
        const now = new Date('2026-08-31T23:59:59.999Z');

        const prognose = SalesPrognose.forPeriod(fact, period, 2_000_000, now);

        // elapsedDays = 30 (31-е число ещё не закончилось) — factor = 31/30.
        expect(prognose.getTurnover()).toBe(Math.round((2_100_000 * 31) / 30));
    });

    it('ровно в начале следующего месяца период полностью прошёл — прогноз равен факту месяца', () => {
        const fact = SalesFact.calculate({
            turnover: 2_100_000,
            cost: 1_000_000,
            quantity: 60,
            planTurnover: 2_000_000,
        });
        const now = new Date('2026-09-01T00:00:00.000Z');

        const prognose = SalesPrognose.forPeriod(fact, period, 2_000_000, now);

        expect(prognose.getTurnover()).toBe(fact.getTurnover());
    });
});
