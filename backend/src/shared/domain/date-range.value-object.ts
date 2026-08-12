import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface DateRangeProps {
    from: Date;
    to: Date;
}

// Диапазон дат по двум произвольным ISO-строкам (не привязан к месяцу, в
// отличие от Period) — заменяет ручную валидацию `new Date(str)` +
// `isNaN(...)`, продублированную по контроллерам, начиная с
// `src/TODO/deals/deals.controller.ts` (GET /deals?from&to). Общий
// примитив в src/shared/domain/, а не внутри конкретного модуля — та же
// пара "from/to" нужна за пределами одного read-модели/домена, как и
// Period.
export class DateRange extends ValueObject<DateRangeProps> {
    static create(fromRaw: string, toRaw: string): DateRange {
        const from = new Date(fromRaw);
        const to = new Date(toRaw);

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            throw new ArgumentInvalidException(
                `Неверный формат даты. Используйте ISO 8601: 2026-01-01 или 2026-01-01T00:00:00Z (from="${fromRaw}", to="${toRaw}")`,
            );
        }

        if (from.getTime() > to.getTime()) {
            throw new ArgumentInvalidException(
                `Начало диапазона не может быть позже конца: from="${fromRaw}" позже to="${toRaw}"`,
            );
        }

        return new DateRange({ from, to });
    }

    getFrom(): Date {
        return this.props.from;
    }

    getTo(): Date {
        return this.props.to;
    }
}
