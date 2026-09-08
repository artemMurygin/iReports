import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface SalesPlanApprovalProps {
    approvedBy: number;
    approvedAt: Date;
}

// Кто и когда утвердил строку плана — approvedBy/approvedAt всегда
// заполняются и очищаются вместе (см. SalesPlan.approve()/edit()), поэтому
// не два nullable-поля entity, а один объект, который либо есть целиком,
// либо отсутствует целиком.
export class SalesPlanApproval extends ValueObject<SalesPlanApprovalProps> {
    static create(
        approvedBy: number,
        approvedAt: Date = new Date(),
    ): SalesPlanApproval {
        if (!approvedBy) {
            throw new ArgumentInvalidException(
                'Необходимо указать сотрудника, утверждающего план продаж',
            );
        }
        return new SalesPlanApproval({ approvedBy, approvedAt });
    }

    getApprovedBy(): number {
        return this.props.approvedBy;
    }

    getApprovedAt(): Date {
        return this.props.approvedAt;
    }
}
