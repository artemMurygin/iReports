import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface ShopSalesPlanApprovalProps {
    approvedBy: number;
    approvedAt: Date;
}

// Зеркало domains/service/modules/sales/domain/value-objects/
// sales-plan-approval.value-object.ts (Фаза 7
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop. approvedBy/approvedAt всегда заполняются и очищаются
// вместе (см. ShopSalesPlan.approve()/edit()), поэтому не два
// nullable-поля entity, а один объект, который либо есть целиком, либо
// отсутствует целиком.
export class ShopSalesPlanApproval extends ValueObject<ShopSalesPlanApprovalProps> {
    static create(
        approvedBy: number,
        approvedAt: Date = new Date(),
    ): ShopSalesPlanApproval {
        if (!approvedBy) {
            throw new ArgumentInvalidException(
                'Необходимо указать сотрудника, утверждающего план продаж',
            );
        }
        return new ShopSalesPlanApproval({ approvedBy, approvedAt });
    }

    getApprovedBy(): number {
        return this.props.approvedBy;
    }

    getApprovedAt(): Date {
        return this.props.approvedAt;
    }
}
