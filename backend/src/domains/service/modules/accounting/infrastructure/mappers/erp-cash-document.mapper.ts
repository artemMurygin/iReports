import {
    ErpCashDocument as ErpCashDocumentRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';

export class ErpCashDocumentMapper implements Mapper<
    ErpCashDocument,
    Prisma.ErpCashDocumentCreateInput
> {
    toDomain(record: ErpCashDocumentRecord): ErpCashDocument {
        return new ErpCashDocument({
            id: record.id,
            createdAt: record.createdAt,
            props: {
                transactionId: record.transactionId,
                system: record.system,
                kind: record.kind,
                amount: record.amount,
                externalId: record.externalId,
            },
        });
    }

    toPersistence(entity: ErpCashDocument): Prisma.ErpCashDocumentCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            transactionId: entity.transactionId,
            system: entity.system,
            kind: entity.kind,
            amount: entity.amount,
            externalId: entity.externalId,
            createdAt: props.createdAt,
        };
    }
}
