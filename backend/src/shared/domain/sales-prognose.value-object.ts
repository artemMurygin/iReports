import { ValueObject } from '@/shared/domain/value-object.base';
import { Period } from '@/shared/domain/period.value-object';
import { percentOf } from '@/shared/domain/percent';

export interface SalesPrognoseProps {
    turnover: number;
    margin: number;
    marginPercent: number;
    quantity: number;
    percentCompletion: number;
}

// Вход формулы — только числа факта, а не конкретный класс SalesFact:
// SalesPrognose общая для обоих направлений (Фаза 5 для service, Фаза 11
// для shop), а SalesFact/ShopSalesFact — разные классы с разной логикой
// расчёта margin (service считает margin = turnover - cost, shop берёт
// margin из MoySkladDemandPosition.profit как есть, см.
// domains/shop/modules/sales/domain/value-objects/sales-fact.value-object.ts).
// Общий VO не должен зависеть ни от одного из них — только от чисел,
// которые оба факта одинаково умеют отдавать через геттеры.
export interface SalesPrognoseFactInput {
    turnover: number;
    margin: number;
    quantity: number;
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
//
// Живёт в shared, а не в domains/service/modules/sales (где появилась в
// Фазе 5), с Фазы 11 — как только формула понадобилась второму направлению
// (shop), см. docs/payroll/plan-payroll-calculation.md, раздел "Формула
// расчёта SalesPrognose... одна формула для service и shop".
export class SalesPrognose extends ValueObject<SalesPrognoseProps> {
    static forPeriod(
        fact: SalesPrognoseFactInput,
        period: Period,
        planTurnover: number,
        now: Date = new Date(),
    ): SalesPrognose {
        const totalDays = period.getTotalCalendarDays();
        const elapsedDays = period.getElapsedCalendarDays(now);
        const factor = elapsedDays === 0 ? 1 : totalDays / elapsedDays;

        const turnover = Math.round(fact.turnover * factor);
        const margin = Math.round(fact.margin * factor);
        const quantity = Math.round(fact.quantity * factor);

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
