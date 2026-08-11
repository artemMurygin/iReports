import type { AccountingPeriodResponse } from 'ireports-contracts';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// entity === null — период трактуется как OPEN без единого закрытия (нет
// строки в БД, см. AccountingPeriod, шапка комментария).
export function toAccountingPeriodResponse(
    entity: AccountingPeriod | null,
    direction: AccountingDirection,
    period: string,
): AccountingPeriodResponse {
    if (!entity) {
        return {
            direction,
            period,
            status: 'OPEN',
            closedBy: null,
            closedAt: null,
        };
    }
    return {
        direction: entity.direction,
        period: entity.period,
        status: entity.status,
        closedBy: entity.closedBy,
        closedAt: entity.closedAt,
    };
}
