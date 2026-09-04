import { Cashbox } from '@/domains/shop/modules/accounting/domain/entities/cashbox/payout-cashbox-record.entity';

// Локальная персистентность связки «движение баланса → документ ERP»
// направления shop — НЕ путать с ErpCashDocumentPort
// (application/ports/erp-cash-document.port.ts), который дёргает саму ERP
// (МойСклад). Обычный Prisma-репозиторий общей таблицы erp_cash_documents
// (см. prisma/schema/erp-cash.prisma), но, в отличие от одноимённого порта
// direction service (application/ports/payout-cashbox-record-repository.port.ts
// в domains/service), собственный независимый класс shop (Фаза 4
// docs/service-shop-boundary-violations-fix) — до этой фазы
// MoyskladCashDocumentAdapter и create/delete-payout.handler.ts
// инжектили ERP_CASH_DOCUMENT_REPOSITORY/ErpCashDocumentRepositoryPort
// напрямую из domains/service (§2.2 docs/service-shop-boundary-violations.md,
// обратное направление цикла Shop → Service).
export interface PayoutCashboxRecordRepositoryPort {
    // В одной транзакции UnitOfWork с движением баланса и переходом
    // документов начисления в PAID — запрос в ERP делает адаптер ДО этой
    // транзакции, здесь только запись уже полученного externalId.
    // Уникальный индекс transactionId (см. erp-cash.prisma, общий на всю
    // таблицу, не по direction) — защита от задвоения на уровне БД:
    // реализация мапит P2002 в PayoutCashboxRecordAlreadyExistsException.
    insert(entity: Cashbox): Promise<void>;

    // Удаление вместе с движением (DELETE выплаты shop) — по id связки, не
    // по transactionId.
    deleteById(id: string): Promise<void>;

    // Идемпотентность/дедупликация — локальный lookup по уникальному
    // индексу transactionId, а не запрос к самой ERP.
    findByTransactionId(transactionId: string): Promise<Cashbox | null>;

    // Лента баланса — один батч-запрос по всем движениям страницы вместо N
    // findByTransactionId в цикле. Пустой массив на входе даёт пустой
    // результат без обращения к БД.
    findByTransactionIds(transactionIds: string[]): Promise<Cashbox[]>;
}

export const SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY = Symbol(
    'SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY',
);
