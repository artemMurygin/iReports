import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { percentOf } from '@/shared/domain/percent';

export interface ShopSalesFactProps {
    turnover: number;
    margin: number;
    marginPercent: number;
    cost: number;
    quantity: number;
    averageCheck: number;
    percentCompletion: number;
}

export interface ShopSalesFactCalculateInput {
    turnover: number;
    // ⚠️ Готовая маржа из МойСклад (сумма MoySkladDemandPosition.profit по
    // позициям отгрузок периода), а НЕ turnover - cost (см. issue #54,
    // docs/payroll/plan-payroll-calculation.md, Фаза 11): МойСклад считает
    // profit сам, с учётом метода списания себестоимости партии, и это
    // значение может отличаться от прямой разницы turnover - cost —
    // пересчёт по формуле разошёлся бы с отчётностью ERP. cost здесь несёт
    // только справочную роль (отображается в SalesFact.cost), в margin не
    // участвует.
    margin: number;
    cost: number;
    // Float — товар может быть весовым/дробным (MoySkladDemandPosition.quantity
    // типа Float в отличие от service, где quantity — целое число заказов).
    quantity: number;
    // Плановый оборот той же строки (SalesPlan.turnover) — percentCompletion
    // считается относительно плана, симметрично service (см.
    // domains/service/modules/sales/domain/value-objects/sales-fact.value-object.ts).
    planTurnover: number;
}

// Факт продаж магазина по данным МойСклад за период (Фаза 11) — зеркало
// SalesFact направления service с одним принципиальным отличием: margin не
// производная от turnover/cost, а отдельный обязательный вход (см.
// ShopSalesFactCalculateInput.margin выше). marginPercent, averageCheck и
// percentCompletion по-прежнему производные, поэтому задаются только
// фабричным методом. Не персистентная сущность — пересчитывается на каждый
// запрос, как и SalesFact.
export class ShopSalesFact extends ValueObject<ShopSalesFactProps> {
    static calculate(input: ShopSalesFactCalculateInput): ShopSalesFact {
        if (input.turnover < 0) {
            throw new ArgumentInvalidException(
                'Фактический оборот магазина не может быть отрицательным',
            );
        }
        if (input.cost < 0) {
            throw new ArgumentInvalidException(
                'Фактическая себестоимость магазина не может быть отрицательной',
            );
        }
        if (input.quantity < 0) {
            throw new ArgumentInvalidException(
                'Фактическое количество магазина не может быть отрицательным',
            );
        }

        return new ShopSalesFact({
            turnover: input.turnover,
            margin: input.margin,
            marginPercent: percentOf(input.margin, input.turnover),
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
