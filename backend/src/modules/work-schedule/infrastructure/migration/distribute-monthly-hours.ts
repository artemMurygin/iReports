const MAX_SHIFT_HOURS = 16;
const MIN_SHIFT_HOURS = 2;

export interface HoursChunk {
    date: string;
    hours: number;
}

// Раскладывает суммарные часы периода (значение старой EmployeeHoursEntry)
// по календарным дням в формате смен графика (Фаза 5,
// docs/employee-work-schedule/plan-employee-work-schedule.md: одна запись —
// 2..16 часов, WorkDay/ShiftHours не ограничивает деление на дни, только
// диапазон одной смены). ПОЧЕМУ сумма чанков обязана совпасть с
// totalHours ТОЧНО, включая нестандартную дробную часть: ручной ввод
// EmployeeHoursEntry не был ограничен шагом 0,5 (contracts/commands/
// employee-hours-entry.ts принимал любой неотрицательный Float), а
// критерий готовности миграции — тот же `PayPerHour.quantity` у отчёта до и
// после переноса; искажение суммы ради "круглых" чанков этот критерий
// нарушило бы. Поэтому все чанки, кроме последнего, — полные 16-часовые
// смены, а последний донабирает точный (возможно, дробный) остаток.
//
// Если остаток меньше 2 часов и чанков больше одного — недостающее
// перекладывается с предпоследнего чанка (он всегда ровно 16, поэтому после
// переноса остаётся не меньше 14 — внутри допустимого диапазона, и общая
// сумма не меняется).
export function distributeMonthlyHours(
    totalHours: number,
    availableDates: readonly string[],
): HoursChunk[] {
    if (totalHours <= 0) {
        // 0 (или отрицательное — по факту не встречается, EmployeeHoursEntry
        // валидировала hours >= 0, но защищаемся) часов — нечего переносить;
        // findHoursWorked и так возвращает 0 при отсутствии смен.
        return [];
    }

    const chunkHours: number[] = [];
    let remaining = totalHours;
    while (remaining > 0) {
        const chunk = Math.min(remaining, MAX_SHIFT_HOURS);
        chunkHours.push(chunk);
        remaining -= chunk;
    }

    if (chunkHours.length > 1) {
        const lastIndex = chunkHours.length - 1;
        if (chunkHours[lastIndex] < MIN_SHIFT_HOURS) {
            const deficit = MIN_SHIFT_HOURS - chunkHours[lastIndex];
            chunkHours[lastIndex - 1] -= deficit;
            chunkHours[lastIndex] += deficit;
        }
    }

    if (chunkHours[0] < MIN_SHIFT_HOURS) {
        // Единственный чанк меньше минимальной смены — искажать сумму,
        // округляя вверх до 2, миграция не имеет права (см. заголовок
        // файла), а разложить на несколько дней тоже нельзя (итог только
        // один чанк). Сигнал вызывающей стороне для ручной проверки, а не
        // тихая потеря данных.
        throw new Error(
            `Часы (${totalHours}) меньше минимальной смены (${MIN_SHIFT_HOURS}) — перенести без искажения суммы нельзя, требуется ручная проверка`,
        );
    }
    if (chunkHours.length > availableDates.length) {
        throw new Error(
            `Часы (${totalHours}) не помещаются в свободные дни месяца (нужно смен: ${chunkHours.length}, свободных дней: ${availableDates.length})`,
        );
    }

    return chunkHours.map((hours, index) => ({
        date: availableDates[index],
        hours,
    }));
}
