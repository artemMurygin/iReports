import type { ErpCashDocument as ErpCashDocumentContract } from 'ireports-contracts';
import {
    ErpCashDocument as ErpCashDocumentRecord,
    Prisma,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { Cashbox } from '@/domains/shop/modules/accounting/domain/entities/cashbox/payout-cashbox-record.entity';

// Direction = 'shop' проставляется здесь, а не читается с записи (Фаза 4
// docs/service-shop-boundary-violations-fix, см. WHY в
// prisma/schema/erp-cash.prisma) — этот репозиторий/маппер физически
// обслуживает только shop-строки общей таблицы erp_cash_documents.
export class PayoutCashboxRecordMapper implements Mapper<
    Cashbox,
    Prisma.ErpCashDocumentCreateInput
> {
    toDomain(record: ErpCashDocumentRecord): Cashbox {
        return new Cashbox({
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
        entity: Cashbox,
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

    // Связка «движение баланса → документ ERP» → контракт (PRD 3, Фаза 12,
    // PayoutResponse.erpDocument) — ответ создания выплаты показывает оба
    // сразу (движение и документ ERP), чтобы UI сразу отрисовал внешний ID
    // без отдельного запроса.
    toResponse(entity: Cashbox): ErpCashDocumentContract {
        return {
            id: entity.id,
            transactionId: entity.transactionId,
            system: entity.system,
            kind: entity.kind,
            amount: entity.amount,
            externalId: entity.externalId,
            createdAt: entity.createdAt,
        };
    }
}
