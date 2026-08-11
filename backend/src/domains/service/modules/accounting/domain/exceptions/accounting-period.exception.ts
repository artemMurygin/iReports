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
    category: number | null;
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
