import type { WorkScheduleDayCell, WorkScheduleStatus } from 'ireports-contracts'

// Визуальное представление ячейки дня — единый источник true для цвета/фона/подписи и в таблице
// (`ScheduleTableRow`), и в легенде (`LegendRow`), чтобы оба места не могли разойтись в цветах.
// Цвета — токены нового UI Kit (`shared/ui-kit/tokens/theme.css`), сопоставленные с hex-значениями
// дизайна (Cko6w, Legend Row): warn-soft/warn-ink — «Отгул», danger-soft/danger — «Больничный»,
// info-soft/info-ink — «Отпуск» (см. чтение design-Cko6w-calendar.html, узлы `Legend *`).

/** `WorkScheduleStatus` + `EMPTY` — «день не заполнен» (в контракте это `status: null`, а не
 * шестой статус, см. `workScheduleDayCellSchema`), но у ячейки таблицы это отдельный визуальный
 * случай, поэтому здесь — отдельный вариант. */
export type CellVariant = WorkScheduleStatus | 'EMPTY'

type StatusStyle = {
    label: string
    /** Символ/цифра в свотче легенды. У `WORKING` в реальной ячейке вместо него — часы смены. */
    legendGlyph: string
    bgClassName: string
    textClassName: string
    /** Цвет 2px-рамки выбранной пилюли статуса в поповере редактирования дня (Фаза 7, узел
     * `Cko6w` → `Day Editor` → `Status Options`) — не используется в самой ячейке таблицы. У
     * четырёх «особых» статусов совпадает с их собственным акцентным токеном (`warn-ink` и т. д.,
     * тот же, что и `textClassName` без префикса `text-`); у `DAY_OFF`, не имеющего акцентного
     * цвета нигде в UI Kit, взят нейтральный `ink-muted` — единственный статус, для которого
     * дизайн не показывает выбранное состояние (в мокапе выбран только `WORKING`). */
    selectedBorderClassName: string
}

/** Порядок — порядок легенды в дизайне (Работает → Выходной → Отгул → Больничный → Отпуск). */
export const STATUS_STYLE: Record<WorkScheduleStatus, StatusStyle> = {
    WORKING: {
        label: 'Работает',
        legendGlyph: '8',
        bgClassName: 'bg-surface',
        textClassName: 'text-ink',
        selectedBorderClassName: 'border-brand-strong',
    },
    DAY_OFF: {
        label: 'Выходной',
        legendGlyph: '—',
        bgClassName: 'bg-canvas',
        textClassName: 'text-ink-faint',
        selectedBorderClassName: 'border-ink-muted',
    },
    TIME_OFF: {
        label: 'Отгул',
        legendGlyph: 'О',
        bgClassName: 'bg-warn-soft',
        textClassName: 'text-warn-ink',
        selectedBorderClassName: 'border-warn-ink',
    },
    SICK_LEAVE: {
        label: 'Больничный',
        legendGlyph: 'Б',
        bgClassName: 'bg-danger-soft',
        textClassName: 'text-danger',
        selectedBorderClassName: 'border-danger',
    },
    VACATION: {
        label: 'Отпуск',
        legendGlyph: 'От',
        bgClassName: 'bg-info-soft',
        textClassName: 'text-info-ink',
        selectedBorderClassName: 'border-info-ink',
    },
}

export const LEGEND_ORDER: WorkScheduleStatus[] = ['WORKING', 'DAY_OFF', 'TIME_OFF', 'SICK_LEAVE', 'VACATION']

/** `status: null` (день без записи графика) визуально не отличается от `DAY_OFF` — в дизайне нет
 * отдельного обозначения «не заполнено» (легенда покрывает только 5 статусов), а с точки зрения
 * «работал сотрудник в этот день или нет» оба случая читаются одинаково на первый взгляд. */
export function resolveCellVariant(cell: Pick<WorkScheduleDayCell, 'status'>): CellVariant {
    return cell.status ?? 'EMPTY'
}

/** Строка часов с шагом 0,5: целые — без дробной части (`8`), дробные — с одним знаком через
 * запятую (`7,5`), как того требует PRD («итоги … должны совпадать до одного знака после запятой»). */
export function formatHours(hours: number): string {
    return hours % 1 === 0 ? String(hours) : hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

/** Подпись внутри ячейки: часы для `WORKING`, глиф статуса для остальных, «—» для `EMPTY`. */
export function cellLabel(cell: Pick<WorkScheduleDayCell, 'status' | 'hours'>, variant: CellVariant): string {
    if (variant === 'EMPTY') return '—'
    if (variant === 'WORKING') return cell.hours !== null ? formatHours(cell.hours) : '—'
    return STATUS_STYLE[variant].legendGlyph
}

/** Классы фона/текста ячейки для варианта — `EMPTY` рендерится визуально как `DAY_OFF`. */
export function cellStyle(variant: CellVariant): { bgClassName: string; textClassName: string } {
    const status = variant === 'EMPTY' ? 'DAY_OFF' : variant
    const { bgClassName, textClassName } = STATUS_STYLE[status]
    return { bgClassName, textClassName }
}

/** Зелёная обводка ячейки — сотрудник дежурит в этот день (`isOnDuty`; бэкенд допускает `true`
 * только у `WORKING`, так что на практике обводка совпадает только с этим вариантом). Тот же
 * зелёный акцент, что уже держит «сегодняшняя» колонка шапки и подсветка строки после перехода с
 * мобильного экрана (`border-brand-strong`/`ring-brand-strong`) — не заводим отдельный цвет ради
 * третьего похожего индикатора. */
export function dutyRingClassName(cell: Pick<WorkScheduleDayCell, 'isOnDuty'>): string | undefined {
    return cell.isOnDuty ? 'ring-2 ring-inset ring-brand-strong' : undefined
}
