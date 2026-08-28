import {
    ErpCashDocument as ErpCashDocumentRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ShopErpCashDocument } from '@/domains/shop/modules/accounting/domain/entities/shop-erp-cash-document.entity';

// Direction = 'shop' проставляется здесь, а не читается с записи (Фаза 4
// docs/service-shop-boundary-violations-fix, см. WHY в
// prisma/schema/erp-cash.prisma) — этот репозиторий/маппер физически
// обслуживает только shop-строки общей таблицы erp_cash_documents.
export class ShopErpCashDocumentMapper implements Mapper<
    ShopErpCashDocument,
    Prisma.ErpCashDocumentCreateInput
> {
    toDomain(record: ErpCashDocumentRecord): ShopErpCashDocument {
        return new ShopErpCashDocument({
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

    toPersistence(
        entity: ShopErpCashDocument,
    ): Prisma.ErpCashDocumentCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            transactionId: entity.transactionId,
            system: entity.system,
            kind: entity.kind,
            amount: entity.amount,
            externalId: entity.externalId,
            direction: 'shop',
            createdAt: props.createdAt,
        };
    }
}
