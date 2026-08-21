import type { TargetRole, WorkScheduleDayCell } from 'ireports-contracts'

// Визуальное представление ячейки вкладки «Роли» (узел `vO4tI`) — тот же приём, что и
// `cellPresentation.ts` для вкладки «Календарь»: единый источник true для цвета/подписи и в
// таблице (`RolesTable.tsx`), и в легенде (`RoleLegendRow.tsx`), чтобы оба места не могли
// разойтись. Цвета — токены UI Kit (`shared/ui-kit/tokens/theme.css`), сопоставленные с
// hex-значениями дизайна (см. чтение design-vO4tI-roles.html, узлы `Legend *`): brand-soft/ok-ink —
// «Инженер», info-soft/info-ink — «Онлайн-менеджер», warn-soft/warn-ink — «Офлайн-менеджер». У
// «Офиса» дизайн использует фиолетовый (#F1EDFD/#6D28D9), которого нет ни в одном текущем токене
// UI Kit, поэтому для него — единственного — взяты произвольные hex-значения Tailwind (тот же
// приём уже применяется в `shared/ui-kit/molecules/PlanCard.tsx`/`CellProgress.tsx` для похожего
// случая, когда готового токена под цвет нет).

type RoleStyle = {
    label: string
    /** Буква/буквы в ячейке — тот же смысл, что и `legendGlyph` в `cellPresentation.ts`. */
    glyph: string
    bgClassName: string
    textClassName: string
}

/** PRD ограничивает вкладку «Роли» именно этими четырьмя ролями (раздел «Хочу видеть/делать»:
 * «Инженер / Онлайн-менеджер / Офлайн-менеджер / Офис») — это же подтверждает и сама разметка
 * дизайна: `Legend Row` узла `vO4tI` рисует свотч ровно для этих четырёх, никакая другая роль
 * `TargetRole` (`ORDER_MANAGER`/`ONLINE_PURCHASER`/`OFFLINE_PURCHASER` — роли зарплатных правил
 * закупщиков/менеджера заказов) в мокапе не встречается. `Record`, а не `Partial<Record<TargetRole,...>>`
 * — так TypeScript сам не даст забыть добавить сюда пятую роль, если дизайн когда-нибудь её
 * покажет. */
export const ROLE_STYLE: Record<'ENGINEER' | 'ONLINE_MANAGER' | 'OFFLINE_MANAGER' | 'OFFICE', RoleStyle> = {
    ENGINEER: { label: 'Инженер', glyph: 'И', bgClassName: 'bg-brand-soft', textClassName: 'text-ok-ink' },
    ONLINE_MANAGER: {
        label: 'Онлайн-менеджер',
        glyph: 'ОН',
        bgClassName: 'bg-info-soft',
        textClassName: 'text-info-ink',
    },
    OFFLINE_MANAGER: {
        label: 'Офлайн-менеджер',
        glyph: 'ОФ',
        bgClassName: 'bg-warn-soft',
        textClassName: 'text-warn-ink',
    },
    OFFICE: { label: 'Офис', glyph: 'ОС', bgClassName: 'bg-[#F1EDFD]', textClassName: 'text-[#6D28D9]' },
}

/** Порядок легенды — порядок свотчей в дизайне (Инженер → Онлайн-менеджер → Офлайн-менеджер → Офис). */
export const ROLE_LEGEND_ORDER = ['ENGINEER', 'ONLINE_MANAGER', 'OFFLINE_MANAGER', 'OFFICE'] as const

/** Нерабочий день — пятый свотч легенды (`Legend Не рабочий день`), визуально совпадает с
 * `DAY_OFF`-стилем ячейки «Календаря» (тот же canvas/ink-faint), но это своя константа: легенда
 * ролей не должна зависеть от `cellPresentation.ts`, у неё свой независимый набор состояний. */
export const NOT_WORKING_ROLE_STYLE: RoleStyle = {
    label: 'Не рабочий день',
    glyph: '—',
    bgClassName: 'bg-canvas',
    textClassName: 'text-ink-faint',
}

/** Рабочий день, для которого роль ещё не назначена (`role: null`) или назначена ролью вне
 * четырёх, которые показывает вкладка (см. комментарий у `ROLE_STYLE`) — случай, которого сам
 * дизайн не рисует (в мокапе у каждого рабочего дня роль всегда проставлена), но контракт
 * (`workScheduleDayCellSchema`) явно допускает `role: null` при `status: WORKING` — часы/роль
 * заполняются независимо. Нейтральный `surface`-фон (а не `canvas`, как у нерабочего дня) —
 * чтобы рабочий день без роли не выглядел так же, как выходной. */
const UNASSIGNED_WORKING_ROLE_STYLE: RoleStyle = {
    label: 'Роль не указана',
    glyph: '—',
    bgClassName: 'bg-surface',
    textClassName: 'text-ink-faint',
}

function isLegendRole(role: TargetRole): role is keyof typeof ROLE_STYLE {
    return role in ROLE_STYLE
}

/** Единая точка выбора стиля ячейки: нерабочий день → `NOT_WORKING_ROLE_STYLE`, рабочий с одной
 * из четырёх ролей легенды → её `RoleStyle`, рабочий без роли/с ролью вне легенды →
 * `UNASSIGNED_WORKING_ROLE_STYLE`. `roleCellLabel`/`roleCellStyle` ниже — тонкие обёртки над этой
 * функцией, тем же разделением, что и `cellLabel`/`cellStyle` в `cellPresentation.ts`. */
export function resolveRoleCellStyle(cell: Pick<WorkScheduleDayCell, 'status' | 'role'>): RoleStyle {
    if (cell.status !== 'WORKING') return NOT_WORKING_ROLE_STYLE
    if (cell.role && isLegendRole(cell.role)) return ROLE_STYLE[cell.role]
    return UNASSIGNED_WORKING_ROLE_STYLE
}

/** Буква в ячейке — глиф роли для рабочего дня, «—» для нерабочего/неназначенного. */
export function roleCellLabel(cell: Pick<WorkScheduleDayCell, 'status' | 'role'>): string {
    return resolveRoleCellStyle(cell).glyph
}

/** Классы фона/текста ячейки — см. `resolveRoleCellStyle`. */
export function roleCellStyle(cell: Pick<WorkScheduleDayCell, 'status' | 'role'>): {
    bgClassName: string
    textClassName: string
} {
    const { bgClassName, textClassName } = resolveRoleCellStyle(cell)
    return { bgClassName, textClassName }
}
