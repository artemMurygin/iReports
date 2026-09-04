import { ValueObject } from '@/shared/domain/value-object.base';

// Единица измерения денежных полей модуля accounting магазина — Фаза 12
// (зеркало domains/service/modules/accounting/domain/services/money.ts,
// независимая реализация — issue #57 запрещает переиспользовать код
// сервиса). Решение то же и по той же причине: денежные поля МойСклад
// (MoySkladDemandPosition.sum/cost/profit, MoySkladProduct.salePrice/
// buyPrice) объявлены Int в prisma/schema/moySklad.prisma — целые рубли,
// без копеек, округление процентных начислений — Math.round (0.5 — в
// большую сторону), чтобы разные правила (ProductSold, UsedProductSold)
// не расходились на округлении при одинаковой базе.
export class Money extends ValueObject<number> {
    static roundRubles(amount: number): Money {
        return new Money({ value: Math.round(amount) });
    }

    getValue(): number {
        return this.props.value;
    }
}
