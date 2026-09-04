import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { EmployeeWithServiceAccountResponse } from 'ireports-contracts'

import { api, EMPLOYEES_QUERY_KEY } from './api.ts'

/** Строка списка: сотрудник (уже с текущим `isServiceAccount`) + подпись отдела/инициалы. */
export type ServiceAccountRow = {
    employee: EmployeeWithServiceAccountResponse
    departmentName: string
    initials: string
}

const UNKNOWN_DEPARTMENT = 'Без отдела'

/** Инициалы для аватара — `name` уже собран бэкендом как «Имя Фамилия» (contracts/commands/directory.ts). */
function employeeInitials(name: string): string {
    return name
        .split(' ')
        .filter((part) => part !== '')
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}

/**
 * Единственный хук страницы настроек «Служебные аккаунты» (docs/employee-ordering-and-salary-filter,
 * Фаза 4): справочник сотрудников (уже с `isServiceAccount`) + справочник отделов сшиваются в
 * строки списка, локальный поиск по имени, и мутация переключения признака у одного сотрудника.
 *
 * Список приходит от бэкенда уже в едином порядке (`BitrixEmployee.order`, Фаза 1/2) — здесь
 * порядок не пересчитывается, только фильтруется по поиску.
 */
export function useServiceAccountsPage() {
    const queryClient = useQueryClient()

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

    const [search, setSearch] = useState('')

    const departmentNameById = useMemo(
        () => new Map((departments ?? []).map((department) => [department.id, department.name])),
        [departments],
    )

    const rows = useMemo<ServiceAccountRow[]>(
        () =>
            (employees ?? []).map((employee) => ({
                employee,
                departmentName: departmentNameById.get(employee.departmentId) ?? UNKNOWN_DEPARTMENT,
                initials: employeeInitials(employee.name),
            })),
        [employees, departmentNameById],
    )

    const visibleRows = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (query === '') return rows
        return rows.filter((row) => row.employee.name.toLowerCase().includes(query))
    }, [rows, search])

    const excludedCount = useMemo(() => rows.filter((row) => row.employee.isServiceAccount).length, [rows])

    const hasBothSources = employees !== undefined && departments !== undefined
    const loading = isEmployeesFetching || isDepartmentsFetching

    const mutation = useMutation({
        mutationFn: ({ id, isServiceAccount }: { id: number; isServiceAccount: boolean }) =>
            api.setServiceAccount(id, { isServiceAccount }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY })
        },
    })

    function handleToggle(employeeId: number, employeeName: string, nextIsServiceAccount: boolean) {
        mutation.mutate(
            { id: employeeId, isServiceAccount: nextIsServiceAccount },
            {
                onSuccess: () => {
                    toast.success(
                        nextIsServiceAccount
                            ? `«${employeeName}» исключён из зарплаты`
                            : `«${employeeName}» возвращён в зарплатные списки`,
                    )
                },
                onError: (mutationError) => {
                    toast.error('Не удалось изменить признак «служебный»', {
                        description: mutationError instanceof Error ? mutationError.message : String(mutationError),
                    })
                },
            },
        )
    }

    return {
        visibleRows,
        totalCount: rows.length,
        excludedCount,
        search,
        onSearchChange: setSearch,
        isInitialLoad: loading && !hasBothSources,
        isRefreshing: loading && hasBothSources,
        error: employeesError ? employeesError.message : departmentsError ? departmentsError.message : null,
        hasEmployees: rows.length > 0,
        hasVisibleRows: visibleRows.length > 0,
        pendingEmployeeId: mutation.isPending ? mutation.variables?.id : undefined,
        onToggle: handleToggle,
    }
}
