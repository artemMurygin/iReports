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
    // spec: shop/sales#requirement-факт-продаж-вычисляется-из-готовой-маржи-мойсклад-а-не-как-оборот-минус-себестоимость
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
// SalesFact направления service (см. ShopSalesFactCalculateInput.margin
// выше про принципиальное отличие). marginPercent, averageCheck и
// percentCompletion — производные, задаются только фабричным методом.
// spec: shop/sales#requirement-факт-и-прогноз-продаж-не-персистятся-и-пересчитываются-на-каждый-запрос
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
