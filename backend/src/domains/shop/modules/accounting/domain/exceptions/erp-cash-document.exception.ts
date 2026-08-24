import { ConflictException } from '@/shared/exceptions';

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
