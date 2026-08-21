import type { TargetRole } from 'ireports-contracts'

import { ROLE_LABELS } from '@/features/SalaryRuleForm'

// Цвета/глифы ролей мобильного экрана «Отдел сегодня» (узел `A5SbT` -> `Roles Legend` и
// `Section На смене` -> `Roster Card` -> `Avatar`) — своя копия того же маппинга, что и
// `pages/WorkSchedule/model/rolePresentation.ts` (вкладка «Роли», узел `vO4tI`): обе страницы
// красят одни и те же четыре роли в одни и те же цвета UI Kit (см. чтение design-A5SbT-mobile.html
// и design-vO4tI-roles.html — свотчи и hex совпадают 1:1), но код не делят — `pages` не может
// импортировать `pages` (frontend/CLAUDE.md, границы FSD), а ради четырёх строк заводить общий
// kernel-модуль сейчас не стоит (тот же выбор уже сделан в `model/today.ts`/`model/weekDays.ts`
// этой же страницы).

export type RoleStyle = {
    label: string
    /** Буква/буквы в свотче легенды и аватаре ростера. */
    glyph: string
    bgClassName: string
    textClassName: string
}

const ROLE_STYLE: Partial<Record<TargetRole, RoleStyle>> = {
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
    // Фиолетовый — как и в `pages/WorkSchedule/model/rolePresentation.ts`, у «Офиса» нет готового
    // токена UI Kit, поэтому произвольный hex дизайна (тот же приём, что и в `PlanCard`/
    // `CellProgress`, см. комментарий исходного файла).
    OFFICE: { label: 'Офис', glyph: 'ОС', bgClassName: 'bg-[#F1EDFD]', textClassName: 'text-[#6D28D9]' },
}

/** Порядок легенды — порядок свотчей в дизайне (Инженер → Онлайн-менеджер → Офлайн-менеджер →
 * Офис). Легенда рендерит только роли, реально пришедшие в `roleCounts` ответа (бэкенд не отдаёт
 * роли с нулём человек в смене), поэтому эта константа используется лишь косвенно — стабильным
 * порядком самого ответа `GET /v1/work-schedule/shift` уже гарантирован тот же порядок. */
export const ROLE_LEGEND_ORDER: readonly TargetRole[] = ['ENGINEER', 'ONLINE_MANAGER', 'OFFLINE_MANAGER', 'OFFICE']

/** Нейтральный стиль — сотрудник без роли (`role: null`, часы/роль рабочего дня заполняются
 * независимо, см. `WorkDay` value object) или роль вне четырёх легенды (закупщики зарплатных
 * правил — `ORDER_MANAGER`/`ONLINE_PURCHASER`/`OFFLINE_PURCHASER`, в графике работы не
 * встречаются, но enum контракта их не запрещает). */
const NEUTRAL_ROLE_STYLE: RoleStyle = {
    label: 'Без роли',
    glyph: '—',
    bgClassName: 'bg-canvas',
    textClassName: 'text-ink-faint',
}

/** Единая точка выбора стиля роли: `null` -> нейтральный, одна из четырёх ролей легенды -> её
 * цвет, любая другая роль enum'а -> нейтральный цвет с подписью из общего словаря `ROLE_LABELS`
 * (`features/SalaryRuleForm`, покрывает весь `TargetRole`) вместо жёстко зашитого «Без роли». */
export function resolveRoleStyle(role: TargetRole | null): RoleStyle {
    if (!role) return NEUTRAL_ROLE_STYLE
    const style = ROLE_STYLE[role]
    if (style) return style
    return { ...NEUTRAL_ROLE_STYLE, label: ROLE_LABELS[role] }
}
