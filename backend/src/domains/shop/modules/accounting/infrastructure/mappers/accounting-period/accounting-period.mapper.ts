import type { AccountingPeriodResponse } from 'ireports-contracts';
import {
    AccountingPeriod as AccountingPeriodRecord,
    Prisma,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { Period } from '@/shared/domain/period.value-object';
import { ShopPeriodClosure } from '@/domains/shop/modules/accounting/domain/value-objects/period-closure.value-object';

// Зеркало domains/service/modules/accounting/infrastructure/mappers/
// accounting-period.mapper.ts (Фаза 5 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Таблица accounting_periods
// общая для обоих доменов (дискриминатор direction) — здесь он
// подставляется фиксированным 'shop' в toPersistence(), toDomain() его
// намеренно не читает: строки этого направления и так фильтруются
// ShopAccountingPeriodRepository
// (`where: { direction: 'shop' } `).
export class ShopAccountingPeriodMapper implements Mapper<
    ShopAccountingPeriod,
    Prisma.AccountingPeriodCreateInput
> {
    toDomain(record: AccountingPeriodRecord): ShopAccountingPeriod {
        return new ShopAccountingPeriod({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                period: Period.create(record.period),
                status: record.status,
                closure:
                    record.closedBy !== null && record.closedAt !== null
                        ? ShopPeriodClosure.create(
                              record.closedBy,
                              record.closedAt,
                          )
                        : null,
            },
        });
    }

    toPersistence(
        entity: ShopAccountingPeriod,
    ): Prisma.AccountingPeriodCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            direction: 'shop',
            period: entity.period,
            status: entity.status,
            closedBy: entity.closedBy,
            closedAt: entity.closedAt,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }

    // entity === null — период трактуется как OPEN без единого закрытия
    // (нет строки в БД, см. ShopAccountingPeriod, шапка комментария).
    toResponse(
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
}
