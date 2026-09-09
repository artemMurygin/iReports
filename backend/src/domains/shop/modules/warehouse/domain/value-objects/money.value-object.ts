import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// Единица измерения денежных полей отчёта по оборачиваемости — Фаза
// shop-turnover-report. В отличие от Money из domains/shop/modules/accounting
// (целые рубли), здесь сознательно копейки: источники — MoySkladDemandPosition.sum
// (оборот, рубли, но переводится в копейки на границе агрегации) и остаток
// себестоимости из отчёта об остатках МойСклад (`price`, уже в копейках) —
// не переиспользуем чужой Money той же причине, что и между service/shop
// (issue #57): разные единицы измерения требуют разных типов, а не общего
// VO с разной интерпретацией значения.
// implements design.md D7.1/D7.2 of shop-turnover-report (Money в копейках)
export class Money extends ValueObject<number> {
    static ofKopecks(kopecks: number): Money {
        if (!Number.isInteger(kopecks)) {
            throw new ArgumentInvalidException(
                `Сумма в копейках должна быть целым числом, получено: ${kopecks}`,
            );
        }
        if (kopecks < 0) {
            throw new ArgumentInvalidException(
                `Сумма в копейках не может быть отрицательной, получено: ${kopecks}`,
            );
        }
        return new Money({ value: kopecks });
    }

    static zero(): Money {
        return Money.ofKopecks(0);
    }

    getValue(): number {
        return this.props.value;
    }

    add(other: Money): Money {
        return Money.ofKopecks(this.getValue() + other.getValue());
    }
}
