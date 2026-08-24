import type { ErpCashDocumentKind } from 'ireports-contracts';

// Адаптер записи в кассу МойСклада (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 11) — исследование через MCP moysklad (2026-08-24) подтвердило:
// расход — POST /entity/cashout / DELETE /entity/cashout/{id}; приход —
// POST /entity/cashin / DELETE /entity/cashin/{id}. Организация
// (organizationId из ErpCashConfig направления shop) читается реализацией
// самостоятельно — не параметр методов ниже, конфигурация не часть
// операции, которую формирует вызывающая сторона.
//
// TODO(Фаза 12, следующий агент): agent (обязательное поле и у cashout, и у
// cashin) в схеме МойСклада документирован как «метаданные контрагента или
// юрлица» (get_schema_fields('CashOut'/'CashIn'), 2026-08-24) — Employee
// там НЕ упомянут как допустимый тип meta, и это отдельная сущность API
// (get_schema_fields('Employee')) без пересечения полей с Counterparty.
// Прямая ссылка meta.type="employee" в agent, скорее всего, будет отклонена
// МойСкладом либо просто проигнорирована — это нужно перепроверить живым
// вызовом на стенде перед реализацией create(); если agent действительно
// обязан быть Counterparty, адаптеру придётся резолвить сотрудника в
// подходящего контрагента (например, через отдельную настройку
// «сотрудник → контрагент для кассовых ордеров» или заведение контрагента
// на сотрудника один раз) — это не блокирует Фазу 11 (порт/конфигурация не
// зависят от того, как именно резолвится agent), но блокирует Фазу 12,
// пока не подтверждено на практике.
//
// Статьи расходов (expenseItem) — из ErpCashConfig.moySkladExpenseItemId.
// У CashIn аналога статьи нет вообще (см. WHY у moySkladIncomeItemId в
// contracts/commands/erp-cash.ts) — create() для kind: 'INCOME' не должен
// передавать это поле в тело POST /entity/cashin.
//
// sum — конвертация Int (рубли, наш домен) в формат МойСклад (копейки,
// как и у остальных денежных полей API — Product.salePrices и т.п.) делает
// адаптер, не домен/приложение (см. «Технические ограничения» PRD 3);
// финальный формат должен быть перепроверен по документации/пробным
// вызовом непосредственно перед реализацией create/delete.
//
// Порт определён отдельно от одноимённого порта в domains/service
// (application/ports/erp-cash-document.port.ts) — идентичная сигнатура, но
// разные типы/токены DI: домены не переиспользуют код друг друга (см.
// backend/CLAUDE.md, domains/service/CLAUDE.md/domains/shop/CLAUDE.md про
// изоляцию service/shop), а реализации ходят в принципиально разные API.
// Реализация — MoyskladCashDocumentAdapter
// (domains/shop/integrations/moySklad/moysklad-cash-document.adapter.ts),
// забинжена в SHOP_ERP_CASH_DOCUMENT_PORT в shop-accounting.module.ts. См.
// WHY-комментарии над самим адаптером про agent Employee/Counterparty,
// конвертацию sum в копейки и отсутствие статьи доходов у CashIn.
export interface CreateErpCashDocumentParams {
    // Ключ идемпотентности/дедупликации на стороне адаптера (см.
    // «Технические ограничения» PRD 3) — BalanceTransaction.id; МойСклад
    // принимает произвольный externalCode на документе (см.
    // get_schema_fields('CashOut'/'CashIn')), которым можно разметить
    // документ этим значением при реализации create().
    transactionId: string;
    // Целые рубли — конвертация в копейки делает адаптер (см. WHY выше).
    amount: number;
    kind: ErpCashDocumentKind;
    // Bitrix ID сотрудника — резолв в EmployeeIdentity направления shop
    // (EMPLOYEE_ID, MoySkladEmployee.id) делает адаптер через
    // EmployeeIdentityRepositoryPort.findByEmployee (см.
    // modules/employee-identity); сотрудник без такой связи — отказ до
    // обращения в МойСклад (PRD 3, «Критерии готовности»). См. TODO выше —
    // сама по себе EmployeeIdentity ещё не решает, чем будет agent ордера.
    employeeId: number;
    // «Зарплата за 2026-07» / «Аванс» / «Премия» + ФИО сотрудника — текст
    // назначения (description) документа МойСклада.
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

    // Локальный lookup по transactionId, НЕ запрос к МойСкладу: у cashout/
    // cashin нет естественного поиска по нашему transactionId без
    // предварительной разметки через externalCode (см. WHY выше), а
    // собственный уникальный индекс transactionId (см. erp-cash.prisma) уже
    // гарантирует, что документ для одного движения не будет создан дважды.
    // Реализация делегирует в ERP_CASH_DOCUMENT_REPOSITORY (см.
    // domains/service/modules/accounting/application/ports/erp-cash-document-repository.port.ts,
    // переиспользуется как direction-агностичный класс) — этот метод
    // существует на порте отдельно от него только затем, чтобы будущий
    // обработчик выплаты зависел от одного абстрактного ErpCashDocumentPort
    // («создать/удалить/проверить, что уже сделано»), а не от двух разных
    // портов одновременно.
    findByKey(transactionId: string): Promise<FoundErpCashDocument | null>;
}

export const SHOP_ERP_CASH_DOCUMENT_PORT = Symbol(
    'SHOP_ERP_CASH_DOCUMENT_PORT',
);
