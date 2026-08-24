import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useDepartments, useEmployees } from '@/features/TargetDirectory'
import { useSalaryReportSelection } from '@/features/SalaryReportData'
import type { SalaryReportScope } from '@/features/SalaryReportData'

import { useDepartmentSalaryReportAll, type DepartmentDirectionFilter } from './useDepartmentSalaryReportAll.ts'

export type { SalaryReportScope } from '@/features/SalaryReportData'
export type { DepartmentDirectionFilter } from './useDepartmentSalaryReportAll.ts'

/**
 * Страничный медиатор `/salaries` (конвенция `useXPage`, плоский объект состояния — см.
 * `frontend/CLAUDE.md`), тонкая обёртка над переиспользуемым `useSalaryReportSelection`
 * (`features/SalaryReportData`, см. её комментарий) — композиция с двумя её собственными
 * особенностями (см. `AskUserQuestion`-решения задачи "вкладка Все в отчёте отдела" + "отчёт
 * сотрудника — свой URL"):
 *
 * 1) **Отчёт сотрудника — свой URL.** Роут `/salaries/employee/:employeeId` (`app/router.tsx`)
 *    ведёт на этот же компонент; `employeeId` из `useParams()` задаёт начальный `scope`/`employeeId`
 *    `useSalaryReportSelection` при первом монтировании (прямой заход по ссылке/обновление
 *    страницы). Переход из карточки отдела кнопкой «Открыть отчёт» (`DepartmentEmployeeGroupV2`,
 *    `<Link to="/salaries/employee/:id">`) монтирования НЕ вызывает — обе записи роута рендерят
 *    один и тот же элемент `<SalaryReportV2Page />` на одной глубине дерева, React Router переиспользует
 *    уже смонтированный компонент, поэтому начальный `useState` в этот момент не срабатывает повторно.
 *    Это закрывает отдельный `useEffect` ниже: он реагирует на смену `employeeId` в URL и досинхронизирует
 *    `scope`/`employeeId` явно. Обратная синхронизация — обёрнутые `setScope`/`setEmployeeId` держат
 *    адресную строку в синхроне с выбором (переключение на "Отдел" -> `/salaries`, выбор сотрудника
 *    в режиме "Сотрудник" -> `/salaries/employee/:id`) — так что ссылку на конкретного сотрудника
 *    всегда можно скопировать/обновить страницу и получить тот же отчёт.
 *    Дефолт при заходе без `employeeId` в пути — режим "Отдел" (не "Сотрудник", дефолт
 *    `useSalaryReportSelection` без опций): по задаче "по умолчанию отображается зарплата отдела".
 *
 * 2) **Вкладка «Все» в отчёте отдела.** `direction` тут — `DepartmentDirectionFilter`
 *    (`SalaryDirection | 'all'`), а не голый `SalaryDirection` из `useSalaryReportSelection` —
 *    локальный стейт этой страницы, сведённый отчёт считает `useDepartmentSalaryReportAll` (см. её
 *    комментарий, почему сведение на фронте, а не на бэкенде). Общий `selection.departmentReport`/
 *    `selection.direction` этой страницей игнорируются в пользу локальных — задействован только сам
 *    факт наличия department-запроса в `useSalaryReportSelection` для `isDepartmentSelected`.
 *
 * 3) **Отдел по умолчанию — «Розница».** Как только справочник отделов (`useDepartments`)
 *    загрузился и `departmentId` ещё не выбран, подставляется id отдела с именем «Розница» — чтобы
 *    зайдя на страницу (дефолтный scope "Отдел", см. п.1) сразу видеть содержательный отчёт, а не
 *    пустое состояние "Выберите отдел". Если отдела с таким именем в справочнике нет (переименован/
 *    удалён) — просто ничего не подставляется, как и раньше.
 */
export function useSalaryReportPage() {
    const { employeeId: employeeIdParam } = useParams()
    const navigate = useNavigate()
    const routeEmployeeId = employeeIdParam != null ? Number(employeeIdParam) : null

    const selection = useSalaryReportSelection({
        initialScope: routeEmployeeId != null ? 'employee' : 'department',
        initialEmployeeId: routeEmployeeId,
    })

    // Досинхронизация при переходе БЕЗ перемонтирования (см. комментарий выше) — срабатывает
    // только когда в пути реально есть `employeeId` (переход из отдела/по ссылке); переключение
    // scope обратно на "Отдел" уже обрабатывает обёрнутый `setScope` ниже, сюда возвращаться не
    // нужно.
    useEffect(() => {
        if (routeEmployeeId == null) return
        if (selection.scope !== 'employee' || selection.employeeId !== routeEmployeeId) {
            selection.setScope('employee')
            selection.setEmployeeId(routeEmployeeId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeEmployeeId])

    // Дефолт — «Все», а не одно направление: смысл вкладки именно в том, чтобы сразу видеть,
    // сколько отдел получает суммарно, не переключаясь на Сервис/Магазин по отдельности.
    const [directionFilter, setDirectionFilter] = useState<DepartmentDirectionFilter>('all')

    const merged = useDepartmentSalaryReportAll(
        selection.scope === 'department' ? selection.departmentId : null,
        directionFilter,
        selection.period,
    )

    function setScope(scope: SalaryReportScope) {
        selection.setScope(scope)
        if (scope === 'department') navigate('/salaries', { replace: true })
        else if (selection.employeeId != null) navigate(`/salaries/employee/${selection.employeeId}`, { replace: true })
    }

    function setEmployeeId(id: number | null) {
        selection.setEmployeeId(id)
        navigate(id != null ? `/salaries/employee/${id}` : '/salaries', { replace: true })
    }

    const departmentsQuery = useDepartments()
    const employeesQuery = useEmployees()

    useEffect(() => {
        if (selection.departmentId != null) return
        const defaultDepartment = (departmentsQuery.data ?? []).find((department) => department.name === 'Розница')
        if (defaultDepartment) selection.setDepartmentId(defaultDepartment.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departmentsQuery.data, selection.departmentId])

    const isDepartmentScope = selection.scope === 'department'

    return {
        ...selection,
        setScope,
        setEmployeeId,

        direction: directionFilter,
        setDirection: setDirectionFilter,
        departmentReport: isDepartmentScope ? merged.report : null,
        isInitialLoad: isDepartmentScope ? merged.isInitialLoad : selection.isInitialLoad,
        isRefreshing: isDepartmentScope ? merged.isRefreshing : selection.isRefreshing,
        errorMessage: isDepartmentScope ? merged.errorMessage : selection.errorMessage,
        dataVersion: isDepartmentScope ? merged.dataVersion : selection.dataVersion,

        employees: employeesQuery.data ?? [],
        isEmployeesLoading: employeesQuery.isLoading,
        departments: departmentsQuery.data ?? [],
        isDepartmentsLoading: departmentsQuery.isLoading,
    }
}

export type SalaryReportPageState = ReturnType<typeof useSalaryReportPage>
