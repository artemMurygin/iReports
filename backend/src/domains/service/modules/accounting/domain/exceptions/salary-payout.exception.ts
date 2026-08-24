import type { PayoutConfirmationRequired } from 'ireports-contracts';
import { ConflictException } from '@/shared/exceptions';

// «При нулевом или отрицательном остатке, а также при сумме больше остатка —
// предупреждение в UI с явным подтверждением; на API это флаг
// confirmNegativeBalance: true, без которого запрос отклоняется с кодом
// «требуется подтверждение» и текущим остатком в ответе» (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// «В скоупе»). РЕШЕНИЕ по коду ответа (PRD не фиксирует код буквально): 409
// Conflict — тем же приёмом, что и остальные «состояние не позволяет
// операцию сейчас» в проекте (SalaryAccrualPaidException,
// PeriodAlreadyClosedException и т.п.), а не 422: сам запрос синтаксически
// валиден (amount > 0 уже проверен контрактом на границе HTTP), конфликтует
// именно текущее состояние остатка сотрудника. metadata типизирована
// контрактом (payoutConfirmationRequiredSchema) — тот же приём, что
// SalaryAccrualsNotDraftException.metadata.
export class PayoutConfirmationRequiredException extends ConflictException {
    constructor(employeeId: number, balance: number, balanceAfter: number) {
        const metadata: PayoutConfirmationRequired = {
            employeeId,
            balance,
            balanceAfter,
        };
        super(
            `Выплата сотруднику ${employeeId} требует подтверждения — остаток ` +
                `${balance} ₽ станет ${balanceAfter} ₽ после операции ` +
                '(confirmNegativeBalance: true)',
            undefined,
            metadata,
        );
    }
}
