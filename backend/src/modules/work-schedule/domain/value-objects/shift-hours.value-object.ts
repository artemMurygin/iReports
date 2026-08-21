import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

const MIN_HOURS = 2;
const MAX_HOURS = 16;
const HOURS_STEP = 0.5;

// Длительность смены. ПОЧЕМУ value object, а не Float в сущности: у
// значения есть собственные инварианты (2–16 часов с шагом 0,5, см. PRD —
// слайдер в поповере редактирования дня), и они должны действовать не
// только на HTTP-границе (upsertWorkScheduleEntryRequestSchema), но и при
// любом другом пути создания записи — включая чтение из БД, где строку мог
// оставить старый код или ручной SQL.
export class ShiftHours extends ValueObject<number> {
    static create(value: number): ShiftHours {
        if (!Number.isFinite(value)) {
            throw new ArgumentInvalidException('Часы смены должны быть числом');
        }
        if (value < MIN_HOURS || value > MAX_HOURS) {
            throw new ArgumentInvalidException(
                `Часы смены должны быть в диапазоне ${MIN_HOURS}–${MAX_HOURS}, получено: ${value}`,
            );
        }
        // Кратность 0,5 через целочисленность удвоенного значения — так
        // проверка не зависит от погрешности деления на 0.5.
        if (!Number.isInteger(value / HOURS_STEP)) {
            throw new ArgumentInvalidException(
                `Часы смены задаются с шагом ${HOURS_STEP}, получено: ${value}`,
            );
        }
        return new ShiftHours({ value });
    }

    getValue(): number {
        return this.props.value;
    }
}
