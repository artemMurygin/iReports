import type { AccountingPeriodResponse } from 'ireports-contracts';
import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/shop-accounting-period.entity';

// Зеркало domains/service/modules/accounting/application/mappers/
// to-accounting-period-response.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop. entity === null — период трактуется как OPEN без
// единого закрытия (нет строки в БД, см. ShopAccountingPeriod, шапка
// комментария).
export function toShopAccountingPeriodResponse(
    entity: ShopAccountingPeriod | null,
    period: string,
): AccountingPeriodResponse {
    if (!entity) {
        return {
            direction: 'shop',
            period,
            status: 'OPEN',
            closedBy: null,
            closedAt: null,
        };
    }
    return {
        direction: 'shop',
        period: entity.period,
        status: entity.status,
        closedBy: entity.closedBy,
        closedAt: entity.closedAt,
    };
}
