import type { ErpCashDocumentKind } from 'ireports-contracts';

// Адаптер записи в кассу RemOnline (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 11) — исследование через MCP RoApp (2026-08-24) подтвердило:
// POST /finance/accounts/{account_id}/transactions создаёт движение,
// DELETE /finance/accounts/{account_id}/transactions/{transaction_id}
// удаляет. account_id — roappCashboxId из ErpCashConfig направления
// service, читается реализацией самостоятельно (не параметр методов
// ниже — конфигурация не часть операции, которую формирует вызывающая
// сторона, а внутренняя зависимость адаптера, как и клиент HTTP).
//
// В RemOnline нет поля для получателя-сотрудника как агента транзакции
// (client_id — это контрагент/клиент ERP, не сотрудник компании, см.
// исследование): назначение и ФИО сотрудника попадают в description
// текстом — см. CreateErpCashDocumentParams.purpose.
//
// Порт определён отдельно от одноимённого порта в domains/shop
// (application/ports/erp-cash-document.port.ts) — идентичная сигнатура,
// но разные типы/токены DI: домены не переиспользуют код друг друга (см.
// backend/CLAUDE.md, domains/service/CLAUDE.md/domains/shop/CLAUDE.md про
// изоляцию service/shop), а реализации ходят в принципиально разные API.
// Реализация (RoappCashDocumentAdapter, следующий агент) НЕ забинжена в
// SERVICE_ERP_CASH_DOCUMENT_PORT в этой фазе — модуль компилируется без
// неё, провайдера для токена ещё нет.
export interface CreateErpCashDocumentParams {
    // Ключ идемпотентности/дедупликации на стороне адаптера (см.
    // «Технические ограничения» PRD 3: «риск... адаптер проверяет наличие
    // документа в ERP по идемпотентному ключу или назначению+сумме+дате») —
    // здесь это BalanceTransaction.id, которое ещё не существует в ERP ни в
    // каком виде: адаптер не обязан отправлять его в RemOnline (там негде),
    // но может использовать как повод свериться с локальным
    // ErpCashDocumentRepositoryPort.findByTransactionId перед повторной
    // попыткой после таймаута.
    transactionId: string;
    // Целые рубли — конвертация в рубли с копейками (формат amount у
    // POST .../transactions — string) делает адаптер, не домен/приложение
    // (см. «Технические ограничения» PRD 3).
    amount: number;
    kind: ErpCashDocumentKind;
    // Bitrix ID сотрудника — резолв в EMPLOYEE_ID системы ROAPP делает
    // адаптер через EmployeeIdentityRepositoryPort.findByEmployee (см.
    // modules/employee-identity); сотрудник без такой связи — отказ до
    // обращения в RemOnline (PRD 3, «Критерии готовности»).
    employeeId: number;
    // «Зарплата за 2026-07» / «Аванс» / «Премия» + ФИО сотрудника — то, что
    // реально попадает в description движения RemOnline (см. WHY выше).
    purpose: string;
    occurredAt: Date;
}

export interface DeleteErpCashDocumentParams {
    externalId: string;
    kind: ErpCashDocumentKind;
    amount: number;
}

// Найденный документ — форма, которой достаточно вызывающей стороне, чтобы
// решить «пропустить create» или «вызвать delete»; не полный ErpCashDocument
// (id/createdAt — внутренние детали локальной записи, недоступны отсюда).
export interface FoundErpCashDocument {
    externalId: string;
    kind: ErpCashDocumentKind;
    amount: number;
}

export interface ErpCashDocumentPort {
    create(
        params: CreateErpCashDocumentParams,
    ): Promise<{ externalId: string }>;

    delete(document: DeleteErpCashDocumentParams): Promise<void>;

    // Локальный lookup по transactionId, НЕ запрос к RemOnline: у
    // RemOnline нет естественного способа искать движение по нашему
    // transactionId (client_id — это контрагент, а не свободное поле для
    // внешнего ключа), а собственный уникальный индекс transactionId (см.
    // erp-cash.prisma) уже гарантирует, что документ для одного движения
    // не будет создан дважды. Реализация делегирует в
    // ERP_CASH_DOCUMENT_REPOSITORY (см. erp-cash-document-repository.port.ts) —
    // этот метод существует на порте отдельно от него только затем, чтобы
    // будущий обработчик выплаты зависел от одного абстрактного
    // ErpCashDocumentPort («создать/удалить/проверить, что уже сделано»), а
    // не от двух разных портов одновременно.
    findByKey(transactionId: string): Promise<FoundErpCashDocument | null>;
}

export const SERVICE_ERP_CASH_DOCUMENT_PORT = Symbol(
    'SERVICE_ERP_CASH_DOCUMENT_PORT',
);
