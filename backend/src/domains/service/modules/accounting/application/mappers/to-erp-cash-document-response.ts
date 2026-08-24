import type { ErpCashDocument as ErpCashDocumentContract } from 'ireports-contracts';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';

// Связка «движение баланса → документ ERP» → контракт (PRD 3, Фаза 12,
// PayoutResponse.erpDocument): ответ создания выплаты показывает оба сразу
// (движение и документ ERP), чтобы UI сразу отрисовал внешний ID без
// отдельного запроса.
export function toErpCashDocumentResponse(
    entity: ErpCashDocument,
): ErpCashDocumentContract {
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
