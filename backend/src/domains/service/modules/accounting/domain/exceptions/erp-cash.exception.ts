import { ConflictException, NotFoundException } from '@/shared/exceptions';

// «Пустая конфигурация — понятная ошибка до обращения в ERP» (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// раздел «Технические ограничения») — ErpCashConfig физически один класс на
// оба направления (см. application/ports/erp-cash-config.port.ts), поэтому
// исключение тоже generic по direction: реализация МойСклада (Фаза 11/12,
// domains/shop) переиспользует этот же класс, а не заводит свой — так же,
// как переиспользует саму сущность ErpCashConfig.
export class ErpCashConfigMissingException extends ConflictException {
    constructor(direction: string) {
        super(
            `Касса ERP направления "${direction}" не настроена — заполните ` +
                `/v1/${direction}/accounting/erp_cash_config перед операцией`,
        );
    }
}

// «EmployeeIdentity сотрудника в ERP направления обязательна... Проверка
// выполняется до обращения в ERP» (PRD 3, «Технические ограничения» и
// «Критерии готовности») — systemLabel только для текста ошибки
// («RemOnline» / «МойСклад»), сама проверка (какой ExternalSystem/
// EmployeeIdentityType искать) — ответственность конкретного адаптера.
export class EmployeeErpIdentityMissingException extends ConflictException {
    constructor(employeeId: number, systemLabel: string) {
        super(
            `У сотрудника ${employeeId} нет связи с ${systemLabel} ` +
                `(EmployeeIdentity) — операция с кассой невозможна`,
        );
    }
}

// Защита от задвоения (PRD 3, «Технические ограничения»: «либо есть оба,
// либо нет ни одного» + «адаптер проверяет наличие документа... чтобы не
// задвоить») на уровне БД — уникальный индекс transactionId (erp-cash.prisma)
// мапится в понятную ошибку тем же приёмом, что
// SalaryAccrualLineAlreadyAccruedException у BalanceTransactionRepository
// (P2002 → доменное исключение), а не остаётся сырым
// Prisma.PrismaClientKnownRequestError. Generic по direction, как остальные
// исключения этого файла — ErpCashDocumentRepository физически один класс на
// оба направления (см. application/ports/erp-cash-document-repository.port.ts).
export class ErpCashDocumentAlreadyExistsException extends ConflictException {
    constructor(transactionId: string) {
        super(
            `Кассовый документ ERP для движения ${transactionId} уже создан — ` +
                'повторное создание отклонено уникальным индексом transactionId',
        );
    }
}

// Инвариант «либо есть оба, либо нет ни одного» (PRD 3, «Цель») нарушен:
// движение с erpSyncRequired = true, для которого нет связки ErpCashDocument
// — не должен встречаться при штатной работе (создание движения и связки —
// одна транзакция, см. CreateBalanceTransactionHandler), но удаление такого
// движения не может молча продолжить без документа для erpPort.delete().
// NotFoundException, а не ConflictException — сам факт отсутствия записи,
// а не конфликт состояния.
export class ErpCashDocumentMissingForTransactionException extends NotFoundException {
    constructor(transactionId: string) {
        super(
            `Движение ${transactionId} помечено erpSyncRequired, но связка ` +
                'с документом ERP не найдена — данные рассинхронизированы, ' +
                'удаление отклонено до ручной проверки',
        );
    }
}
