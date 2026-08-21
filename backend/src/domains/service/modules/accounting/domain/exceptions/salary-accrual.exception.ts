import type { SalaryAccrualNotDraftRow } from 'ireports-contracts';
import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Повторное открытие периода отклоняется целиком, пока хоть один документ
// начисления периода не в DRAFT (PRD 1: "отказ с перечнем таких документов;
// переоткрытие возможно только после сторно начислений"). Перечень едет в
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
