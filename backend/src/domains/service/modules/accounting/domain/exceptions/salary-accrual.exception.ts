import type { SalaryAccrualNotDraftRow } from 'ireports-contracts';
import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Повторное открытие периода отклоняется целиком, пока хоть один документ
// начисления периода не в DRAFT (PRD 1: "отказ с перечнем таких документов;
// переоткрытие возможно только после отмены начислений"). Перечень едет в
// metadata.accruals — тем же приёмом, что и metadata.rows у
// UnapprovedSalesPlanRowsException (форма — salaryAccrualNotDraftRowSchema в
// contracts).
export class SalaryAccrualsNotDraftException extends ConflictException {
    constructor(
        direction: string,
        period: string,
        accruals: SalaryAccrualNotDraftRow[],
    ) {
        super(
            `Нельзя переоткрыть период ${period} направления "${direction}" — ` +
                `есть документы начисления не в статусе «Черновик» (${accruals.length})`,
            undefined,
            { accruals },
        );
    }
}

export class SalaryAccrualNotFoundException extends NotFoundException {
    constructor(direction: string, id: string) {
        super(`Документ начисления ${id} направления "${direction}" не найден`);
    }
}

export class SalaryAccrualLineNotFoundException extends NotFoundException {
    constructor(accrualId: string, lineId: string) {
        super(`Строка ${lineId} документа начисления ${accrualId} не найдена`);
    }
}

// Действия над строками выплаченного документа запрещены целиком (PRD 2:
// «Отмена невозможна, если документ уже выплачен»; PRD 3 переводит документ
// в PAID) — выплата зафиксировала расчёт как факт движения денег.
export class SalaryAccrualPaidException extends ConflictException {
    constructor(accrualId: string) {
        super(
            `Документ начисления ${accrualId} уже выплачен — ` +
                'строки нельзя проводить, корректировать или отменять',
        );
    }
}

// Повторное проведение строки: второго движения на балансе не появляется —
// на прямой повтор отвечаем конфликтом, а гонку параллельных запросов
// останавливает уникальный индекс (lineId, type) в balance_transactions
// (см. BalanceTransactionRepository).
export class SalaryAccrualLineAlreadyAccruedException extends ConflictException {
    constructor(lineId: string) {
        super(`Строка начисления ${lineId} уже проведена на баланс`);
    }
}

export class SalaryAccrualLineNotAccruedException extends ConflictException {
    constructor(lineId: string) {
        super(
            `Строка начисления ${lineId} не проведена на баланс — отменять нечего`,
        );
    }
}

// Корректировка возможна только до проведения (PRD 2: «корректировка строки
// в ACCRUED — 409»): проведённая строка уже породила движения баланса,
// сначала «Отменить начисление».
export class SalaryAccrualLineNotDraftException extends ConflictException {
    constructor(lineId: string) {
        super(
            `Строка начисления ${lineId} уже проведена — корректировка возможна только в статусе «Черновик»`,
        );
    }
}

// Строка выплачена вместе с документом (PAID) — обратный переход к ACCRUED
// возможен только через SalaryAccrual.revertToAccrued() (удаление выплаты,
// PRD 3), не напрямую.
export class SalaryAccrualLineNotPaidException extends ConflictException {
    constructor(lineId: string) {
        super(`Строка начисления ${lineId} не выплачена — возвращать нечего`);
    }
}

// SalaryAccrual.markPaid() (PRD 3 docs/payroll-closing-and-accrual/
// prd-salary-payout-and-erp-cash-documents.md, «Документы начисления...
// в статусе ACCRUED переходят в PAID») — вызывающая сторона (обработчик
// выплаты) обязана сама отобрать документы со статусом ACCRUED (см.
// SalaryAccrualRepositoryPort.findAccruedByEmployee) ДО вызова markPaid():
// документ в DRAFT/PARTIALLY_ACCRUED не переходит в PAID даже при
// закрытом остатке («пока остаток > 0, документ остаётся ACCRUED» — а если
// остаток уже ≤ 0, а документ ещё не полностью проведён, PRD этот случай не
// описывает, решение консервативное — PAID не выставляется, см. отчёт
// Фазы 12). Это исключение — защита инварианта на случай, если вызывающая
// сторона всё же передаст в markPaid() документ не в ACCRUED, а не штатный
// путь работы обработчика.
export class SalaryAccrualNotAccruedException extends ConflictException {
    constructor(accrualId: string) {
        super(
            `Документ начисления ${accrualId} не в статусе «Ожидает выплаты» — ` +
                'выплата не может пометить его выплаченным',
        );
    }
}

// Обратный переход SalaryAccrual.revertToAccrued() (удаление выплаты, PRD 3:
// «возврат документов начисления из PAID в ACCRUED») — вызывается только для
// документов, которые сама выплата (перед удалением) действительно перевела
// в PAID; попытка откатить документ не в PAID — сигнал ошибки в вызывающем
// коде, а не штатная ситуация.
export class SalaryAccrualNotPaidException extends ConflictException {
    constructor(accrualId: string) {
        super(
            `Документ начисления ${accrualId} не выплачен — возвращать в «Ожидает выплаты» нечего`,
        );
    }
}
