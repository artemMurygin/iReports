import { ValueObject } from '@/shared/domain/value-object.base';
import { Period } from '@/shared/domain/period.value-object';
import { SalesFact, percentOf } from './sales-fact.value-object';

export interface SalesPrognoseProps {
    turnover: number;
    margin: number;
    marginPercent: number;
    quantity: number;
    percentCompletion: number;
}

// Прогноз до конца месяца (Фаза 5, решение по открытому вопросу PRD
// зафиксировано в docs/payroll/plan-payroll-calculation.md): линейная
// экстраполяция факта по прошедшим календарным дням месяца, одна формула
// для service и shop —
//
//   prognose.turnover = fact.turnover / прошедшие_дни * всего_дней_в_месяце
//
// и аналогично для margin/quantity. marginPercent и percentCompletion НЕ
// экстраполируются напрямую — они пересчитываются из уже экстраполированных
// turnover/margin (через тот же percentOf(), что и в SalesFact), иначе для
// точки "конец месяца" (elapsedDays = totalDays, prognose = fact) они могли
// бы разойтись с fact.marginPercent/fact.percentCompletion на округлении.
//
// "Прошедший день" — см. Period.getElapsedCalendarDays(): день засчитывается
// прошедшим только целиком, текущие сутки не в счёт. Единственная формула
// покрывает оба крайних случая без отдельных веток:
// - elapsedDays === 0 (план ещё не начался или это первая же минута месяца)
//   — экстраполировать нечего, множитель 1, прогноз равен факту (который в
//   этой точке тоже нулевой);
// - elapsedDays === totalDays (период уже закрыт или полностью в прошлом —
//   `now` на или после конца периода) — множитель 1, прогноз равен факту
//   месяца, что и требуется ("экстраполировать нечего").
export class SalesPrognose extends ValueObject<SalesPrognoseProps> {
    static forPeriod(
        fact: SalesFact,
        period: Period,
        planTurnover: number,
        now: Date = new Date(),
    ): SalesPrognose {
        const totalDays = period.getTotalCalendarDays();
        const elapsedDays = period.getElapsedCalendarDays(now);
        const factor = elapsedDays === 0 ? 1 : totalDays / elapsedDays;

        const turnover = Math.round(fact.getTurnover() * factor);
        const margin = Math.round(fact.getMargin() * factor);
        const quantity = Math.round(fact.getQuantity() * factor);

        return new SalesPrognose({
            turnover,
            margin,
            marginPercent: percentOf(margin, turnover),
            quantity,
            percentCompletion: percentOf(turnover, planTurnover),
        });
    }

    getTurnover(): number {
        return this.props.turnover;
    }

    getMargin(): number {
        return this.props.margin;
    }

    getMarginPercent(): number {
        return this.props.marginPercent;
    }

    getQuantity(): number {
        return this.props.quantity;
    }

    getPercentCompletion(): number {
        return this.props.percentCompletion;
    }
}
