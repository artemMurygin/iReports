import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface ShopPeriodClosureProps {
    closedBy: number;
    closedAt: Date;
}

// Зеркало domains/service/modules/accounting/domain/value-objects/
// period-closure.value-object.ts (Фаза 5 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Кто и когда закрыл расчётный
// период — closedBy/closedAt всегда заполняются и очищаются вместе (см.
// ShopAccountingPeriod.close()/.reopen()), поэтому не два nullable-поля
// entity, а один объект, который либо есть целиком, либо отсутствует
// целиком.
export class ShopPeriodClosure extends ValueObject<ShopPeriodClosureProps> {
    static create(
        closedBy: number,
        closedAt: Date = new Date(),
    ): ShopPeriodClosure {
        if (!closedBy) {
            throw new ArgumentInvalidException(
                'Необходимо указать сотрудника, закрывающего расчётный период',
            );
        }
        return new ShopPeriodClosure({ closedBy, closedAt });
    }

    getClosedBy(): number {
        return this.props.closedBy;
    }

    getClosedAt(): Date {
        return this.props.closedAt;
    }
}
