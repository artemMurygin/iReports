import { ConflictException, NotFoundException } from '@/shared/exceptions';

export class BalanceTransactionNotFoundException extends NotFoundException {
    constructor(direction: string, id: string) {
        super(`Движение баланса ${id} направления "${direction}" не найдено`);
    }
}

// Сторно (MANUAL_REVERSAL) — только для ручных движений без документа ERP
// (PRD 2): движения начисления удаляются действием «Отменить начисление»
// строки документа, выплата и движения с erpSyncRequired исправляются
// удалением вместе с документом ERP (PRD 3), а сторно самого сторно не
// существует — ошибочное сторно исправляется повторным созданием ручного
// движения.
export class BalanceTransactionNotReversibleException extends ConflictException {
    constructor(id: string, reason: string) {
        super(`Движение баланса ${id} нельзя сторнировать: ${reason}`);
    }
}

// Повторное сторно одного движения: прямой повтор ловится проверкой по
// ленте, гонку параллельных запросов — уникальное ограничение БД на
// reversedTransactionId (репозиторий мапит P2002 сюда же).
export class BalanceTransactionAlreadyReversedException extends ConflictException {
    constructor(id: string) {
        super(`Движение баланса ${id} уже сторнировано`);
    }
}
