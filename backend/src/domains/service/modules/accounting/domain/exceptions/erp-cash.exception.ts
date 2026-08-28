import { ConflictException, NotFoundException } from '@/shared/exceptions';

// «Пустая конфигурация — понятная ошибка до обращения в ERP» (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// раздел «Технические ограничения») — брошено только RoappCashDocumentAdapter
// (direction всегда "service"); у shop собственный аналог,
// ShopErpCashConfigIncompleteException
// (domains/shop/modules/accounting/domain/exceptions/erp-cash-document.exception.ts),
// брошенный MoyskladCashDocumentAdapter.
export class ErpCashConfigMissingException extends ConflictException {
    constructor(direction: string) {
        super(
            `Касса ERP направления "${direction}" не настроена — заполните ` +
                'нужные переменные окружения (см. config/erp-cash.config.ts ' +
                `направления "${direction}") в .env и перезапустите backend`,
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
// Prisma.PrismaClientKnownRequestError. Брошено ErpCashDocumentRepository
// (service) — используется RoappCashDocumentAdapter и сквозным
// src/modules/employee-balance/ (общая лента баланса, см. WHY на
// erp-cash-document.entity.ts); у shop с Фазы 4
// docs/service-shop-boundary-violations-fix собственный аналог,
// ShopErpCashDocumentAlreadyExistsException
// (domains/shop/modules/accounting/domain/exceptions/erp-cash-document.exception.ts).
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
// а не конфликт состояния. У shop с Фазы 4
// docs/service-shop-boundary-violations-fix собственный аналог,
// ShopErpCashDocumentMissingForTransactionException.
export class ErpCashDocumentMissingForTransactionException extends NotFoundException {
    constructor(transactionId: string) {
        super(
            `Движение ${transactionId} помечено erpSyncRequired, но связка ` +
                'с документом ERP не найдена — данные рассинхронизированы, ' +
                'удаление отклонено до ручной проверки',
        );
    }
}
