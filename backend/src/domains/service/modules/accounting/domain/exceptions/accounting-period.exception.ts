import { ConflictException } from '@/shared/exceptions';

export class PeriodAlreadyClosedException extends ConflictException {
    constructor(direction: string, period: string) {
        super(`Период ${period} направления "${direction}" уже закрыт`);
    }
}

export class PeriodNotClosedException extends ConflictException {
    constructor(direction: string, period: string) {
        super(
            `Период ${period} направления "${direction}" не закрыт — открывать нечего`,
        );
    }
}

export interface UnapprovedSalesPlanRowMeta {
    id: string;
    department: number;
    category: string | null;
}

// Закрытие периода отклоняется целиком, а не частично, пока есть хоть одна
// неутверждённая строка плана продаж (см. PRD: "закрытие фиксирует зарплаты
// снапшотом, а значит план ... должен быть подтверждён человеком"). Список
// строк едет в metadata — фронтенд (Фаза 17) показывает его пользователю
// без дополнительного запроса.
export class UnapprovedSalesPlanRowsException extends ConflictException {
    constructor(
        direction: string,
        period: string,
        rows: UnapprovedSalesPlanRowMeta[],
    ) {
        super(
            `Нельзя закрыть период ${period} направления "${direction}" — ` +
                `есть неутверждённые строки плана продаж (${rows.length})`,
            undefined,
            { rows },
        );
    }
}

// Закрыть можно только истёкший календарный месяц — текущий и будущий
// отклоняются до любых обращений к ERP/БД (PRD 1: "месяц ещё не закончился").
export class PeriodNotExpiredException extends ConflictException {
    constructor(direction: string, period: string) {
        super(
            `Нельзя закрыть период ${period} направления "${direction}" — месяц ещё не закончился`,
            undefined,
            { direction, period },
        );
    }
}

// Запись в источники часов (EmployeeHoursEntry, в будущем — график работы)
// за месяц, закрытый по направлению, отклоняется с указанием, кем и когда
// месяц закрыт (PRD 1, "Блокировка графика работы и ручных часов"). Единая
// точка проверки — EnsurePeriodNotClosedService.
export class AccountingPeriodClosedException extends ConflictException {
    constructor(
        direction: string,
        period: string,
        closedBy: number | null,
        closedAt: Date | null,
    ) {
        super(
            `Период ${period} направления "${direction}" закрыт — изменение данных за этот месяц недоступно`,
            undefined,
            { direction, period, closedBy, closedAt },
        );
    }
}
