import { ConflictException, NotFoundException } from '@/shared/exceptions';

export class BalanceTransactionNotFoundException extends NotFoundException {
    constructor(id: string) {
        super(`Движение баланса ${id} не найдено`);
    }
}

// Прямое удаление (DELETE, Фаза 8b) — только для ручных движений без
// документа ERP (PRD 2): движения начисления удаляются действием «Отменить
// начисление» строки документа, выплата и движения с erpSyncRequired
// удаляются вместе с документом ERP (PRD 3).
export class BalanceTransactionNotDeletableException extends ConflictException {
    constructor(id: string, reason: string) {
        super(`Движение баланса ${id} нельзя удалить: ${reason}`);
    }
}
