import { ConflictException } from '@/shared/exceptions';

// Зеркало domains/service/modules/accounting/domain/exceptions/
// accounting-period.exception.ts (Фаза 5 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. ErpSyncFailedException и
// AccountingPeriodClosedException НЕ дублируются здесь: первая — общая,
// direction-агностичная, брошенная ErpPeriodSyncRunner из
// src/shared/application/exceptions/erp-sync-failed.exception.ts (Фаза 9
// docs/service-shop-boundary-violations-fix), вторая — часть проверки
// work-schedule, которая по PRD (раздел "Не в скоупе") сознательно остаётся
// привязана только к направлению service.
export class ShopPeriodAlreadyClosedException extends ConflictException {
    constructor(period: string) {
        super(`Период ${period} направления "shop" уже закрыт`);
    }
}

export class ShopPeriodNotClosedException extends ConflictException {
    constructor(period: string) {
        super(
            `Период ${period} направления "shop" не закрыт — открывать нечего`,
        );
    }
}

export interface ShopUnapprovedSalesPlanRowMeta {
    id: string;
    department: number;
    category: string | null;
}

// Закрытие периода отклоняется целиком, а не частично, пока есть хоть одна
// неутверждённая строка плана продаж (см. PRD: "закрытие фиксирует зарплаты
// снапшотом, а значит план ... должен быть подтверждён человеком"). Список
// строк едет в metadata — фронтенд показывает его пользователю без
// дополнительного запроса.
export class ShopUnapprovedSalesPlanRowsException extends ConflictException {
    constructor(period: string, rows: ShopUnapprovedSalesPlanRowMeta[]) {
        super(
            `Нельзя закрыть период ${period} направления "shop" — ` +
                `есть неутверждённые строки плана продаж (${rows.length})`,
            undefined,
            { rows },
        );
    }
}

// Закрыть можно только истёкший календарный месяц — текущий и будущий
// отклоняются до любых обращений к ERP/БД (PRD 1: "месяц ещё не закончился").
export class ShopPeriodNotExpiredException extends ConflictException {
    constructor(period: string) {
        super(
            `Нельзя закрыть период ${period} направления "shop" — месяц ещё не закончился`,
            undefined,
            { direction: 'shop', period },
        );
    }
}
