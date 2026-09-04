import { Cashbox } from '@/domains/service/modules/accounting/domain/entities/payout-cashbox-record.entity';

// Локальная персистентность связки «движение баланса → документ ERP» (PRD 3,
// Фаза 11) — НЕ путать с ErpCashDocumentPort (application/ports/erp-cash-document.port.ts
// в domains/service и domains/shop), который дёргает саму ERP. Этот порт —
// обычный Prisma-репозиторий локальной таблицы erp_cash_documents,
// направление не хранит (система — ExternalSystem на записи, direction —
// атрибут того, через какой адаптер документ был создан, а не персистентности).
//
// Физически определён в domains/service. До Фазы 4
// docs/service-shop-boundary-violations-fix domains/shop заводил
// собственный экземпляр реализации под тем же токеном (тот же приём, что
// BalanceTransactionRepositoryPort/SalaryAccrualRepositoryPort); с этой
// фазы у shop собственный независимый порт
// PayoutCashboxRecordRepositoryPort/SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY (см.
// domains/shop/modules/accounting/application/ports/cashbox/payout-cashbox-record-repository.port.ts).
// Этот порт остаётся используемым RoappCashDocumentAdapter (service) и
// сквозным src/modules/employee-balance/ (общая лента баланса, движения
// обоих направлений вперемешку — см. WHY в payout-cashbox-record.entity.ts).
export interface PayoutCashboxRecordRepositoryPort {
    // В одной транзакции UnitOfWork с движением баланса и переходом
    // документов начисления в PAID (PRD 3, «Технические ограничения») —
    // запрос в ERP делает адаптер ДО этой транзакции, здесь только запись
    // уже полученного externalId. Уникальный индекс transactionId (см.
    // erp-cash.prisma) — защита от задвоения на уровне БД: реализация
    // мапит P2002 в PayoutCashboxRecordAlreadyExistsException (domain/exceptions/erp-cash.exception.ts),
    // а не пробрасывает сырой Prisma-эксепшн — тот же приём, что
    // BalanceTransactionRepositoryPort.insertMany.
    insert(entity: Cashbox): Promise<void>;

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
    findByTransactionId(transactionId: string): Promise<Cashbox | null>;

    // Лента баланса сотрудника (PRD 3, «Критерии готовности»: «Внешний ID
    // документа ERP сохраняется и показывается в ленте баланса») — один
    // батч-запрос по всем движениям страницы вместо N findByTransactionId в
    // цикле (см. GetEmployeeBalanceService). Пустой массив на входе даёт
    // пустой результат без обращения к БД.
    findByTransactionIds(transactionIds: string[]): Promise<Cashbox[]>;
}

export const PAYOUT_CASHBOX_RECORD_REPOSITORY = Symbol(
    'PAYOUT_CASHBOX_RECORD_REPOSITORY',
);
