import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface SalesFactProps {
    turnover: number;
    margin: number;
    marginPercent: number;
    cost: number;
    quantity: number;
    averageCheck: number;
    percentCompletion: number;
}

export interface SalesFactCalculateInput {
    turnover: number;
    cost: number;
    quantity: number;
    // Плановый оборот той же строки (SalesPlan.turnover) — percentCompletion
    // считается относительно плана, поэтому факт без плана не собирается
    // (см. docs/payroll/plan-payroll-calculation.md, Фаза 5).
    planTurnover: number;
}

// Факт продаж по данным ERP за период (Фаза 5) — margin, marginPercent,
// averageCheck и percentCompletion всегда производные от turnover/cost/
// quantity/planTurnover, поэтому не задаются отдельными полями конструктора,
// а вычисляются одним фабричным методом: так они никогда не могут разойтись
// с исходными суммами (тот же принцип, что у SalesPlanApproval — группа
// полей, которая всегда меняется вместе). Не персистентная сущность — не
// хранится в БД отдельно от плана, пересчитывается на каждый запрос
// (кэширование результата целиком — Фаза 6).
export class SalesFact extends ValueObject<SalesFactProps> {
    static calculate(input: SalesFactCalculateInput): SalesFact {
        if (input.turnover < 0) {
            throw new ArgumentInvalidException(
                'Фактический оборот не может быть отрицательным',
            );
        }
        if (input.cost < 0) {
            throw new ArgumentInvalidException(
                'Фактическая себестоимость не может быть отрицательной',
            );
        }
        if (input.quantity < 0) {
            throw new ArgumentInvalidException(
                'Фактическое количество не может быть отрицательным',
            );
        }

        const margin = input.turnover - input.cost;

        return new SalesFact({
            turnover: input.turnover,
            margin,
            marginPercent: percentOf(margin, input.turnover),
            cost: input.cost,
            quantity: input.quantity,
            averageCheck:
                input.quantity !== 0
                    ? Math.round(input.turnover / input.quantity)
                    : 0,
            percentCompletion: percentOf(input.turnover, input.planTurnover),
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

    getCost(): number {
        return this.props.cost;
    }

    getQuantity(): number {
        return this.props.quantity;
    }

    getAverageCheck(): number {
        return this.props.averageCheck;
    }

    getPercentCompletion(): number {
        return this.props.percentCompletion;
    }
}

// Процент `part` от `whole`, округлённый до сотых, без деления на 0 —
// общий помощник для SalesFact и SalesPrognose (marginPercent,
// percentCompletion), чтобы правило округления не разъезжалось по модулю.
export function percentOf(part: number, whole: number): number {
    if (!whole) {
        return 0;
    }
    return Math.round((part / whole) * 10000) / 100;
}
