import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';

// Локальная персистентность связки «движение баланса → документ ERP» (PRD 3,
// Фаза 11) — НЕ путать с ErpCashDocumentPort (application/ports/erp-cash-document.port.ts
// в domains/service и domains/shop), который дёргает саму ERP. Этот порт —
// обычный Prisma-репозиторий локальной таблицы erp_cash_documents,
// направление не хранит (система — ExternalSystem на записи, direction —
// атрибут того, через какой адаптер документ был создан, а не персистентности).
//
// Direction-агностичен, как BalanceTransactionRepositoryPort/
// SalaryAccrualRepositoryPort: физически определён в domains/service,
// domains/shop заводит собственный экземпляр реализации под тем же токеном
// (см. domains/service/CLAUDE.md) — будущий обработчик выплаты каждого
// направления (Фаза 12) пишет и читает через один и тот же класс.
export interface ErpCashDocumentRepositoryPort {
    // В одной транзакции UnitOfWork с движением баланса и переходом
    // документов начисления в PAID (PRD 3, «Технические ограничения») —
    // запрос в ERP делает адаптер ДО этой транзакции, здесь только запись
    // уже полученного externalId. Уникальный индекс transactionId (см.
    // erp-cash.prisma) — защита от задвоения на уровне БД: реализация
    // мапит P2002 в ErpCashDocumentAlreadyExistsException (domain/exceptions/erp-cash.exception.ts),
    // а не пробрасывает сырой Prisma-эксепшн — тот же приём, что
    // BalanceTransactionRepositoryPort.insertMany.
    insert(entity: ErpCashDocument): Promise<void>;

    // Удаление вместе с движением (DELETE payout / DELETE ручного движения
    // с erpSyncRequired, Фаза 12) — по id связки, не по transactionId:
    // движение и документ удаляются в одной транзакции, id документа к
    // этому моменту уже известен вызывающей стороне (нашла его через
    // findByTransactionId или только что создала).
    deleteById(id: string): Promise<void>;

    // Идемпотентность/дедупликация (PRD 3, «Технические ограничения»:
    // «адаптер проверяет наличие документа... чтобы не задвоить») — локальный
    // lookup по уникальному индексу transactionId, а не запрос к самой ERP:
    // см. WHY-комментарий у ErpCashDocumentPort.findByKey ниже, оба
    // findByKey (порта и репозитория) относятся к одному и тому же вопросу
    // «уже создан ли документ для этого движения», отличаются только тем,
    // что порт — это то, что видит будущий обработчик выплаты, а
    // реализация порта (адаптер ERP) внутри просто делегирует сюда.
    findByTransactionId(transactionId: string): Promise<ErpCashDocument | null>;

    // Лента баланса сотрудника (PRD 3, «Критерии готовности»: «Внешний ID
    // документа ERP сохраняется и показывается в ленте баланса») — один
    // батч-запрос по всем движениям страницы вместо N findByTransactionId в
    // цикле (см. GetEmployeeBalanceService). Пустой массив на входе даёт
    // пустой результат без обращения к БД.
    findByTransactionIds(transactionIds: string[]): Promise<ErpCashDocument[]>;
}

export const ERP_CASH_DOCUMENT_REPOSITORY = Symbol(
    'ERP_CASH_DOCUMENT_REPOSITORY',
);
