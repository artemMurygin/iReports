import type { ErpCashDocument as ErpCashDocumentContract } from 'ireports-contracts';
import { ShopErpCashDocument } from '@/domains/shop/modules/accounting/domain/entities/shop-erp-cash-document.entity';

// Связка «движение баланса → документ ERP» → контракт (PRD 3, Фаза 12,
// PayoutResponse.erpDocument) для выплаты направления shop — контракт
// direction-агностичен (см. erpCashDocumentSchema в
// contracts/commands/erp-cash.ts), поэтому форма ответа идентична
// to-erp-cash-document-response.ts направления service, но собственная
// функция (Фаза 4 docs/service-shop-boundary-violations-fix): принимает
// ShopErpCashDocument, а не ErpCashDocument domains/service.
export function toShopErpCashDocumentResponse(
    entity: ShopErpCashDocument,
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
