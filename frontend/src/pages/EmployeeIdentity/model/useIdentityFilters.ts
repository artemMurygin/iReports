import { useMemo, useState } from 'react'

import type { EmployeeIdentityRow } from './useEmployeeIdentities.ts'

/**
 * Вкладки панели фильтров (макет `CpVvw`, SegmentedControl слева):
 * `all` — все сотрудники, `partial` — опознаны ровно в одной из двух систем,
 * `none` — ни одной связи (у таких не считается зарплата).
 */
export type IdentityTab = 'all' | 'partial' | 'none'

/** Сентинел «все отделы» в селекте: radix Select не умеет пустую строку как значение. */
export const ALL_DEPARTMENTS = 'all'

/**
 * Локальные фильтры таблицы — вкладка, отдел и поиск. Живут на клиенте: весь список связей и
 * весь справочник сотрудников уже загружены целиком (см. `useEmployeeIdentities`), поэтому
 * серверная фильтрация означала бы лишний round-trip на каждое нажатие клавиши.
 *
 * Строки приходят аргументом, а не запрашиваются внутри: хук не знает про источник данных и
 * ничего не грузит сам — композиция происходит уровнем выше, в `useEmployeeIdentityPage`
 * (frontend/CLAUDE.md, «model-хуки с плоским объектом состояния»).
 */
export function useIdentityFilters(rows: EmployeeIdentityRow[]) {
    const [tab, setTab] = useState<IdentityTab>('all')
    const [departmentId, setDepartmentId] = useState<string>(ALL_DEPARTMENTS)
    const [search, setSearch] = useState('')

    const visibleRows = useMemo(() => {
        // Поиск в макете подписан как «Поиск по фамилии», но `name` из справочника — это одна
        // строка «Имя Фамилия» (contracts/commands/directory.ts), отдельного поля фамилии нет.
        // Поэтому ищем подстроку по всему имени: запрос «мурыг» находит и по фамилии, и по
        // имени, что для поиска строки в таблице только удобнее.
        const query = search.trim().toLowerCase()

        return rows.filter((row) => {
            if (tab === 'partial' && row.linkedSystemsCount !== 1) return false
            if (tab === 'none' && row.linkedSystemsCount !== 0) return false
            if (departmentId !== ALL_DEPARTMENTS && String(row.employee.departmentId) !== departmentId) return false
            if (query !== '' && !row.employee.name.toLowerCase().includes(query)) return false
            return true
        })
    }, [rows, tab, departmentId, search])

    return {
        tab,
        setTab,
        departmentId,
        setDepartmentId,
        search,
        setSearch,
        visibleRows,
        /** Хоть один фильтр сужает выдачу — нужно, чтобы отличить «ничего не нашли» от «данных нет». */
        isFiltered: tab !== 'all' || departmentId !== ALL_DEPARTMENTS || search.trim() !== '',
    }
}
