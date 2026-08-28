import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Отказы MoyskladCashDocumentAdapter (ErpCashDocumentPort, Фаза 11) ДО
// обращения в МойСклад — PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// «Критерии готовности»: пустая конфигурация/несвязанный сотрудник не должны
// доходить до HTTP-вызова.

// Конфигурация кассы направления shop (ErpCashConfig) не заполнена или
// заполнена не полностью для операции, которую пытаются выполнить:
// organizationId обязателен всегда (и у cashout, и у cashin),
// moySkladExpenseItemId — только для EXPENSE (cashout).
export class ShopErpCashConfigIncompleteException extends ConflictException {
    constructor(missingField: string) {
        super(
            `Конфигурация кассы МойСклад не заполнена (отсутствует поле «${missingField}») — ` +
                'заполните её через PUT /v1/shop/accounting/erp_cash_config перед созданием кассового документа',
        );
    }
}

// У сотрудника Bitrix нет связи EmployeeIdentity(MOY_SKLAD, EMPLOYEE_ID) —
// адаптер не может построить meta-ссылку agent документа МойСклада без id
// сотрудника в самом МойСкладе (см. WHY-комментарий над
// MoyskladCashDocumentAdapter.create про ограничение agent Employee/Counterparty).
export class ShopEmployeeMoySkladIdentityMissingException extends ConflictException {
    constructor(employeeId: number) {
        super(
            `У сотрудника Bitrix #${employeeId} нет связи EmployeeIdentity с сотрудником МойСклада ` +
                '(EMPLOYEE_ID) — кассовый документ не может быть создан',
        );
    }
}

// Защита от задвоения (см. ShopErpCashDocumentRepositoryPort.insert) на
// уровне БД — уникальный индекс transactionId (общий на всю таблицу
// erp_cash_documents, не по direction, см. erp-cash.prisma) мапится в
// понятную ошибку — собственный класс direction shop (Фаза 4
// docs/service-shop-boundary-violations-fix), не переиспользующий
// ErpCashDocumentAlreadyExistsException domains/service.
export class ShopErpCashDocumentAlreadyExistsException extends ConflictException {
    constructor(transactionId: string) {
        super(
            `Кассовый документ ERP для движения ${transactionId} уже создан — ` +
                'повторное создание отклонено уникальным индексом transactionId',
        );
    }
}

// Инвариант «либо есть оба, либо нет ни одного» нарушен: движение с
// erpSyncRequired = true направления shop, для которого нет связки
// ShopErpCashDocument — не должно встречаться при штатной работе (создание
// движения и связки — одна транзакция), но удаление такого движения не
// может молча продолжить без документа для erpPort.delete(). Собственный
// класс direction shop (Фаза 4), не переиспользующий
// ErpCashDocumentMissingForTransactionException domains/service.
export class ShopErpCashDocumentMissingForTransactionException extends NotFoundException {
    constructor(transactionId: string) {
        super(
            `Движение ${transactionId} помечено erpSyncRequired, но связка ` +
                'с документом ERP направления shop не найдена — данные ' +
                'рассинхронизированы, удаление отклонено до ручной проверки',
        );
    }
}
