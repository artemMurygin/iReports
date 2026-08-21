import type { TargetRole, UpsertWorkScheduleEntryRequest, WorkScheduleStatus } from 'ireports-contracts'

// Чистая логика поповера редактирования дня (Фаза 7 плана «График работы сотрудников», узел
// `Cko6w` → `Day Editor`), вынесенная из `ui/DayEditorPopover/model/useDayEditor.ts` — тем же
// приёмом, что и `scheduleAggregates.ts`/`cellPresentation.ts`: хук остаётся тонкой обвязкой
// (состояние + вызов мутации), а решения, что именно сохранять, тестируются без React.

/** Часы смены — зеркалит `shiftHoursSchema` из `contracts/commands/work-schedule.ts` (2–16,
 * шаг 0,5); своя копия границ на фронте по тому же прецеденту, что и `isValidMonth`/
 * `workScheduleMonthSchema` в `format.ts` — без рантайм-импорта схемы ради трёх чисел. */
export const MIN_SHIFT_HOURS = 2
export const MAX_SHIFT_HOURS = 16
export const SHIFT_HOURS_STEP = 0.5

/** Часы, которыми предзаполняется слайдер при переключении статуса на «Работает» у дня, где часы
 * ещё не были заданы (пустая ячейка или день без записи графика) — полная смена, самое частое
 * значение в таблице (см. легенду «Цифра в ячейке — часы за смену»). Не значение по умолчанию
 * бэкенда (там часы у `WORKING` необязательны вовсе, см. `WorkDay.create`) — только стартовая
 * позиция слайдера в UI, чтобы он не открывался «в никуда» на границе диапазона. */
export const DEFAULT_SHIFT_HOURS = 8

/** Округляет к шагу 0,5 и зажимает в диапазон 2–16. `toFixed(1)` — защита от плавающей запятой
 * (`0.1 + 0.2`-подобных артефактов) после деления/умножения на шаг. */
export function clampHours(value: number): number {
    const stepped = Number((Math.round(value / SHIFT_HOURS_STEP) * SHIFT_HOURS_STEP).toFixed(1))
    return Math.min(MAX_SHIFT_HOURS, Math.max(MIN_SHIFT_HOURS, stepped))
}

/** Часы, которые нужно сохранить при переключении на статус `status`: `null` для любого статуса,
 * кроме `WORKING` (инвариант «часы только у рабочего дня», проверяется доменом на бэкенде, но
 * поповер не должен даже пытаться его нарушить), у `WORKING` — уже выбранные часы, а если их ещё
 * не было (`previousHours === null`) — `DEFAULT_SHIFT_HOURS`. */
export function resolveHoursForStatus(status: WorkScheduleStatus, previousHours: number | null): number | null {
    if (status !== 'WORKING') return null
    return previousHours !== null ? previousHours : DEFAULT_SHIFT_HOURS
}

/**
 * Тело `PUT /v1/work-schedule/entries` для одной правки дня. `role` в поповере календаря
 * (Фаза 7) не редактируется — это вкладка «Роли» (Фаза 8, вне скоупа), — но передаётся, если уже
 * была задана: `WorkScheduleEntry.edit()` на бэкенде заменяет состояние дня целиком (см.
 * `work-schedule-entry.entity.ts`), и не передать существующую роль здесь значило бы молча стереть
 * её при простой смене часов/статуса на «Работает». `hours`/`role`, переданные для не-`WORKING`
 * статуса, всегда отбрасываются (не только `undefined`) — тем же инвариантом, что и на бэкенде.
 */
export function buildUpsertPayload(
    employeeId: number,
    date: string,
    status: WorkScheduleStatus,
    hours: number | null,
    role: TargetRole | null,
): UpsertWorkScheduleEntryRequest {
    if (status !== 'WORKING') {
        return { employeeId, date, status }
    }

    return {
        employeeId,
        date,
        status,
        ...(hours !== null ? { hours } : {}),
        ...(role !== null ? { role } : {}),
    }
}
