import {
    ErpCashConfig as ErpCashConfigRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';

export class ErpCashConfigMapper implements Mapper<
    ErpCashConfig,
    Prisma.ErpCashConfigCreateInput
> {
    toDomain(record: ErpCashConfigRecord): ErpCashConfig {
        return new ErpCashConfig({
            id: record.id,
            updatedAt: record.updatedAt,
            props: {
                direction: record.direction,
                roappCashboxId: record.roappCashboxId,
                moySkladExpenseItemId: record.moySkladExpenseItemId,
                moySkladIncomeItemId: record.moySkladIncomeItemId,
                organizationId: record.organizationId,
            },
        });
    }

    toPersistence(entity: ErpCashConfig): Prisma.ErpCashConfigCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            direction: entity.direction,
            roappCashboxId: entity.roappCashboxId,
            moySkladExpenseItemId: entity.moySkladExpenseItemId,
            moySkladIncomeItemId: entity.moySkladIncomeItemId,
            organizationId: entity.organizationId,
            updatedAt: props.updatedAt,
        };
    }
}
