import type { SalaryAccrualNotDraftRow } from 'ireports-contracts';
import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Зеркало domains/service/modules/accounting/domain/exceptions/
// salary-accrual.exception.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Direction фиксирован "shop" в
// самих сообщениях (не параметр конструктора) — тот же приём, что уже
// применён у ShopPeriodAlreadyClosedException/ShopPeriodNotClosedException
// (см. shop-accounting-period.exception.ts).
export class ShopSalaryAccrualsNotDraftException extends ConflictException {
    constructor(period: string, accruals: SalaryAccrualNotDraftRow[]) {
        super(
            `Нельзя переоткрыть период ${period} направления "shop" — ` +
                `есть документы начисления не в статусе «Черновик» (${accruals.length})`,
            undefined,
            { accruals },
        );
    }
}

export class ShopSalaryAccrualNotFoundException extends NotFoundException {
    constructor(id: string) {
        super(`Документ начисления ${id} направления "shop" не найден`);
    }
}

export class ShopSalaryAccrualLineNotFoundException extends NotFoundException {
    constructor(accrualId: string, lineId: string) {
        super(`Строка ${lineId} документа начисления ${accrualId} не найдена`);
    }
}

export class ShopSalaryAccrualPaidException extends ConflictException {
    constructor(accrualId: string) {
        super(
            `Документ начисления ${accrualId} уже выплачен — ` +
                'строки нельзя проводить, корректировать или отменять',
        );
    }
}

export class ShopSalaryAccrualLineAlreadyAccruedException extends ConflictException {
    constructor(lineId: string) {
        super(`Строка начисления ${lineId} уже проведена на баланс`);
    }
}

export class ShopSalaryAccrualLineNotAccruedException extends ConflictException {
    constructor(lineId: string) {
        super(
            `Строка начисления ${lineId} не проведена на баланс — отменять нечего`,
        );
    }
}

export class ShopSalaryAccrualLineNotDraftException extends ConflictException {
    constructor(lineId: string) {
        super(
            `Строка начисления ${lineId} уже проведена — корректировка возможна только в статусе «Черновик»`,
        );
    }
}

export class ShopSalaryAccrualLineNotPaidException extends ConflictException {
    constructor(lineId: string) {
        super(`Строка начисления ${lineId} не выплачена — возвращать нечего`);
    }
}

export class ShopSalaryAccrualNotAccruedException extends ConflictException {
    constructor(accrualId: string) {
        super(
            `Документ начисления ${accrualId} не в статусе «Ожидает выплаты» — ` +
                'выплата не может пометить его выплаченным',
        );
    }
}

export class ShopSalaryAccrualNotPaidException extends ConflictException {
    constructor(accrualId: string) {
        super(
            `Документ начисления ${accrualId} не выплачен — возвращать в «Ожидает выплаты» нечего`,
        );
    }
}
