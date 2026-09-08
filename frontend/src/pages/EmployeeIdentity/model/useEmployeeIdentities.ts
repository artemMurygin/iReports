import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { EmployeeIdentityResponse, EmployeeResponse, ExternalSystem } from 'ireports-contracts'

import { api } from './api.ts'
import { employeeInitials } from './identityLabels.ts'

/** Строка таблицы: сотрудник Bitrix + его связи, разложенные по внешним системам. */
export type EmployeeIdentityRow = {
    employee: EmployeeResponse
    departmentName: string
    initials: string
    identitiesBySystem: Record<ExternalSystem, EmployeeIdentityResponse[]>
    /** Сколько из двух систем опознают сотрудника — 0, 1 или 2. Основа всех фильтров и покрытия. */
    linkedSystemsCount: number
}

/** Карточка «Покрытие ERP» (макет `CpVvw`, блок над фильтрами). */
export type IdentityCoverage = {
    total: number
    both: number
    partial: number
    none: number
}

const EMPTY_COVERAGE: IdentityCoverage = { total: 0, both: 0, partial: 0, none: 0 }

const UNKNOWN_DEPARTMENT = 'Без отдела'

/**
 * Единственный источник данных страницы: справочник сотрудников Bitrix, справочник отделов и
 * все связи разом — сшиваются в плоский список строк таблицы.
 *
 * Ведущий список — именно справочник сотрудников, а не связи: экран отвечает на вопрос «кого
 * ещё не связали», поэтому сотрудник без единой связи обязан быть строкой таблицы (и попасть в
 * сегмент «ни в одной» карточки покрытия). Связи, у которых `bitrixEmployeeId` не нашёлся в
 * справочнике (уволенный сотрудник), в таблицу не попадают — показывать строку без имени и
 * отдела бессмысленно, а удалить такую связь всё равно нечем.
 *
 * Флаги загрузки разделены на `isInitialLoad`/`isRefreshing` (frontend/CLAUDE.md): после
 * мутации список инвалидируется, и фоновый рефетч не должен схлопывать уже отрисованную
 * таблицу — отсюда `placeholderData: keepPreviousData` и расчёт от `isFetching`.
 */
export function useEmployeeIdentities() {
    const {
        data: employees,
        isFetching: isEmployeesFetching,
        error: employeesError,
    } = useQuery({ ...api.getEmployees(), placeholderData: keepPreviousData })

    const {
        data: departments,
        isFetching: isDepartmentsFetching,
        error: departmentsError,
    } = useQuery({ ...api.getDepartments(), placeholderData: keepPreviousData })

    const {
        data: identities,
        dataUpdatedAt: identitiesUpdatedAt,
        isFetching: isIdentitiesFetching,
        error: identitiesError,
    } = useQuery({ ...api.getIdentities(), placeholderData: keepPreviousData })

    const departmentNameById = useMemo(
        () => new Map((departments ?? []).map((department) => [department.id, department.name])),
        [departments],
    )

    // Строки строятся только когда пришли ОБА источника: справочник задаёт сам список строк,
    // связи — их содержимое. Если упал любой из двух, строк нет вовсе, и `EmployeeIdentityBody`
    // показывает один баннер ошибки. Иначе отказ загрузки связей выглядел бы как факт: таблица
    // со сплошными плейсхолдерами «Связать» и карточка покрытия, где все сотрудники в сегменте
    // «ни в одной — зарплата не считается».
    const hasBothSources = employees !== undefined && identities !== undefined

    const rows = useMemo<EmployeeIdentityRow[]>(() => {
        if (!hasBothSources) return []

        const byEmployee = new Map<number, EmployeeIdentityResponse[]>()
        for (const identity of identities ?? []) {
            const bucket = byEmployee.get(identity.bitrixEmployeeId)
            if (bucket) bucket.push(identity)
            else byEmployee.set(identity.bitrixEmployeeId, [identity])
        }

        return (employees ?? []).map((employee) => {
            const employeeIdentities = byEmployee.get(employee.id) ?? []
            const identitiesBySystem: Record<ExternalSystem, EmployeeIdentityResponse[]> = {
                ROAPP: employeeIdentities.filter((identity) => identity.system === 'ROAPP'),
                MOY_SKLAD: employeeIdentities.filter((identity) => identity.system === 'MOY_SKLAD'),
            }

            return {
                employee,
                departmentName: departmentNameById.get(employee.departmentId) ?? UNKNOWN_DEPARTMENT,
                initials: employeeInitials(employee.name),
                identitiesBySystem,
                linkedSystemsCount:
                    (identitiesBySystem.ROAPP.length > 0 ? 1 : 0) + (identitiesBySystem.MOY_SKLAD.length > 0 ? 1 : 0),
            }
        })
    }, [hasBothSources, employees, identities, departmentNameById])

    // Покрытие считается по всем сотрудникам, а не по видимым: это показатель состояния
    // справочника целиком, он не должен «улучшаться» от того, что включили фильтр.
    const coverage = useMemo<IdentityCoverage>(
        () =>
            rows.reduce<IdentityCoverage>(
                (acc, row) => ({
                    total: acc.total + 1,
                    both: acc.both + (row.linkedSystemsCount === 2 ? 1 : 0),
                    partial: acc.partial + (row.linkedSystemsCount === 1 ? 1 : 0),
                    none: acc.none + (row.linkedSystemsCount === 0 ? 1 : 0),
                }),
                EMPTY_COVERAGE,
            ),
        [rows],
    )

    const loading = isEmployeesFetching || isDepartmentsFetching || isIdentitiesFetching
    const error = employeesError ?? departmentsError ?? identitiesError

    return {
        rows,
        coverage,
        departments: departments ?? [],
        // Считается от готовности обоих источников, а не от `rows.length`: справочник обычно
        // отвечает раньше связей, и по длине строк спиннер снимался бы на кадр раньше времени —
        // ровно на тот кадр, где у всех ещё «Связать», а покрытие показывает 100% в сегменте
        // «ни в одной».
        isInitialLoad: loading && !hasBothSources,
        isRefreshing: loading && hasBothSources,
        error: error ? error.message : null,
        dataVersion: identitiesUpdatedAt,
    }
}
