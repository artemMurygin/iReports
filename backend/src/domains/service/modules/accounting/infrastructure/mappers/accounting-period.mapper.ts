import {
    AccountingPeriod as AccountingPeriodRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { Period } from '@/shared/domain/period.value-object';
import { PeriodClosure } from '@/domains/service/modules/accounting/domain/value-objects/period-closure.value-object';

export class AccountingPeriodMapper implements Mapper<
    AccountingPeriod,
    Prisma.AccountingPeriodCreateInput
> {
    toDomain(record: AccountingPeriodRecord): AccountingPeriod {
        return new AccountingPeriod({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                direction: record.direction,
                period: Period.create(record.period),
                status: record.status,
                closure:
                    record.closedBy !== null && record.closedAt !== null
                        ? PeriodClosure.create(record.closedBy, record.closedAt)
                        : null,
            },
        });
    }

    toPersistence(
        entity: AccountingPeriod,
    ): Prisma.AccountingPeriodCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            direction: entity.direction,
            period: entity.period,
            status: entity.status,
            closedBy: entity.closedBy,
            closedAt: entity.closedAt,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
