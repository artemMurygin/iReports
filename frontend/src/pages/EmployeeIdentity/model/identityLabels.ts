import { Globe, Headset, IdCard, Store, type LucideIcon } from 'lucide-react'
import type { EmployeeIdentityResponse, EmployeeIdentityType, ExternalSystem } from 'ireports-contracts'

/**
 * Человекочитаемый словарь экрана «Связи сотрудников» (Pencil: design/sallary-first-iteration.pen,
 * фреймы `CpVvw` — список, `NjnJ3` — модалка связи): контрактные enum'ы `ExternalSystem` /
 * `EmployeeIdentityType` -> подписи, иконки и подсказки из макета.
 *
 * Всё в одном файле, потому что подписи чипа в таблице и подписи карточек-радио в форме — это
 * один и тот же словарь, показанный с разной детализацией: чип пишет короткий тип («ID»,
 * «Онлайн-менеджер»), форма — тот же тип развёрнуто («ID сотрудника») плюс поясняющую строку.
 * Держать их врозь означало бы два места правки на одно переименование.
 */

export const SYSTEM_LABEL: Record<ExternalSystem, string> = {
    ROAPP: 'RemOnline',
    MOY_SKLAD: 'МойСклад',
}

export const SYSTEM_DESCRIPTION: Record<ExternalSystem, string> = {
    ROAPP: 'Заказы и услуги сервиса',
    MOY_SKLAD: 'Отгрузки и продажи магазина',
}

// Порядок колонок таблицы и карточек-радио «Внешняя система» в форме — один и тот же.
export const SYSTEMS: ExternalSystem[] = ['ROAPP', 'MOY_SKLAD']

// Короткая подпись типа — левая половина чипа «Тип · Значение» (`ID · 412`,
// `Онлайн-менеджер · Мурыгин А.`).
export const IDENTITY_TYPE_LABEL: Record<EmployeeIdentityType, string> = {
    EMPLOYEE_ID: 'ID',
    ONLINE_MANAGER_FIELD: 'Онлайн-менеджер',
    MOY_SKLAD_ONLINE_PURCHASER_FIELD: 'Онлайн-закупщик',
    MOY_SKLAD_OFFLINE_PURCHASER_FIELD: 'Офлайн-закупщик',
}

export const IDENTITY_TYPE_ICON: Record<EmployeeIdentityType, LucideIcon> = {
    EMPLOYEE_ID: IdCard,
    ONLINE_MANAGER_FIELD: Headset,
    MOY_SKLAD_ONLINE_PURCHASER_FIELD: Globe,
    MOY_SKLAD_OFFLINE_PURCHASER_FIELD: Store,
}

export type IdentityTypeOption = {
    value: EmployeeIdentityType
    title: string
    description: string
}

/**
 * Набор типов идентификатора зависит от выбранной системы (макет `NjnJ3`): `EMPLOYEE_ID` есть
 * в обеих, но описывается по-разному, поля закупщиков существуют только у МойСклада, а
 * «онлайн-менеджер» — только у RemOnline. Поэтому это Record по системе, а не общий список с
 * фильтром: перечислить допустимые пары явно дешевле, чем читать правило фильтрации.
 */
export const IDENTITY_TYPE_OPTIONS: Record<ExternalSystem, IdentityTypeOption[]> = {
    ROAPP: [
        {
            value: 'EMPLOYEE_ID',
            title: 'ID сотрудника',
            description: 'Ссылка на карточку в RemOnline',
        },
        {
            value: 'ONLINE_MANAGER_FIELD',
            title: 'Онлайн-менеджер',
            description: 'Строка из заказа — оборвётся при переименовании',
        },
    ],
    MOY_SKLAD: [
        {
            value: 'EMPLOYEE_ID',
            title: 'ID сотрудника',
            description: 'Ссылка на карточку в МойСкладе',
        },
        {
            value: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
            title: 'Онлайн-закупщик',
            description: 'Доп. поле позиции отгрузки',
        },
        {
            value: 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD',
            title: 'Офлайн-закупщик',
            description: 'Доп. поле позиции отгрузки',
        },
    ],
}

/** Подсказка под полем «Идентификатор» — зависит и от системы, и от типа (макет `NjnJ3`). */
export function identifierHint(system: ExternalSystem, identifierType: EmployeeIdentityType): string {
    if (identifierType === 'EMPLOYEE_ID') {
        return system === 'ROAPP'
            ? 'Число из адреса карточки сотрудника: app.remonline.ru/employees/412'
            : 'Идентификатор сотрудника из адреса его карточки в МойСкладе'
    }

    if (identifierType === 'ONLINE_MANAGER_FIELD') {
        return 'Значение поля «Онлайн-менеджер» в заказе RemOnline — ровно так, как оно там написано'
    }

    return 'Значение доп. поля закупщика на позиции отгрузки МойСклада — ровно так, как оно там написано'
}

/** Подпись чипа идентификатора: «Тип · Значение» (`ID · 412`). */
export function identityChipLabel(identity: EmployeeIdentityResponse): string {
    return `${IDENTITY_TYPE_LABEL[identity.identifierType]} · ${identity.externalId}`
}

/** Подзаголовок модалки удаления: «RemOnline · ID · 412 — Артём Мурыгин» (макет `CweSL`). */
export function identityFullLabel(identity: EmployeeIdentityResponse, employeeName: string): string {
    const label = `${SYSTEM_LABEL[identity.system]} · ${identityChipLabel(identity)}`
    return employeeName ? `${label} — ${employeeName}` : label
}

/**
 * Инициалы для аватара сотрудника. `name` из `/v1/directory/employees` уже собран как
 * «Имя Фамилия» (см. contracts/commands/directory.ts), поэтому берутся первые буквы первых
 * двух слов.
 */
export function employeeInitials(name: string): string {
    return name
        .split(' ')
        .filter((part) => part !== '')
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}

/** Склонение слова «сотрудник» по количеству — «1 сотрудник», «2 сотрудника», «5 сотрудников». */
export function employeesPlural(count: number): string {
    const mod100 = Math.abs(count) % 100
    const mod10 = mod100 % 10
    if (mod100 >= 11 && mod100 <= 14) return 'сотрудников'
    if (mod10 === 1) return 'сотрудник'
    if (mod10 >= 2 && mod10 <= 4) return 'сотрудника'
    return 'сотрудников'
}
