import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface PeriodClosureProps {
    closedBy: number;
    closedAt: Date;
}

// Кто и когда закрыл расчётный период — closedBy/closedAt всегда
// заполняются и очищаются вместе (см. AccountingPeriod.close()/.reopen()),
// поэтому не два nullable-поля entity, а один объект, который либо есть
// целиком, либо отсутствует целиком (тот же приём, что и
// modules/sales/domain/value-objects/sales-plan-approval.value-object.ts).
export class PeriodClosure extends ValueObject<PeriodClosureProps> {
    static create(
        closedBy: number,
        closedAt: Date = new Date(),
    ): PeriodClosure {
        if (!closedBy) {
            throw new ArgumentInvalidException(
                'Необходимо указать сотрудника, закрывающего расчётный период',
            );
        }
        return new PeriodClosure({ closedBy, closedAt });
    }

    getClosedBy(): number {
        return this.props.closedBy;
    }

    getClosedAt(): Date {
        return this.props.closedAt;
    }
}
