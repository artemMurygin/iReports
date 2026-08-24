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

// DELETE .../payout/:id (PRD 3, Фаза 12) принимает только движения типа
// PAYOUT СВОЕГО направления — попытка удалить через этот эндпоинт ручное
// движение, движение начисления или выплату другого направления отклоняется
// явно (409), а не молча трактуется как «не найдено» (движение с таким id
// существует, просто это не та выплата).
export class BalanceTransactionNotPayoutException extends ConflictException {
    constructor(id: string, direction: string) {
        super(
            `Движение ${id} не является выплатой направления "${direction}" — ` +
                'удаляйте выплату через DELETE .../payout/:id своего направления, ' +
                'ручное движение — через DELETE .../balance/transactions/:id',
        );
    }
}
