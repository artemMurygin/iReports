import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { useDepartments, useEmployees } from '@/features/TargetDirectory'
import { useSalaryReportSelection } from '@/features/SalaryReportData'

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
 * 1) **Отчёт сотрудника — свой URL.** Режим отчёта не переключается вручную (см.
 *    `SalaryReportFiltersV2`) — он полностью определяется маршрутом: `/salaries` -> "Отдел",
 *    `/salaries/employee/:employeeId` -> "Сотрудник". Роут `/salaries/employee/:employeeId`
 *    (`app/router.tsx`) ведёт на этот же компонент; `employeeId` из `useParams()` задаёт начальный
 *    `scope`/`employeeId` `useSalaryReportSelection` при первом монтировании (прямой заход по
 *    ссылке/обновление страницы, а также переход по `<Link to="/salaries/employee/:id">` из
 *    `DepartmentEmployeeGroupV2`). Переход из карточки отдела монтирования НЕ вызывает — обе записи
 *    роута рендерят один и тот же элемент `<SalaryReportV2Page />` на одной глубине дерева, React
 *    Router переиспользует уже смонтированный компонент, поэтому начальный `useState` в этот момент
 *    не срабатывает повторно. Это закрывает отдельный `useEffect` ниже: он реагирует на смену
 *    `employeeId` в URL и досинхронизирует `scope`/`employeeId` явно — так что ссылку на конкретного
 *    сотрудника всегда можно скопировать/обновить страницу и получить тот же отчёт.
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
    const routeEmployeeId = employeeIdParam != null ? Number(employeeIdParam) : null

    const selection = useSalaryReportSelection({
        initialScope: routeEmployeeId != null ? 'employee' : 'department',
        initialEmployeeId: routeEmployeeId,
    })

    // Досинхронизация при переходе БЕЗ перемонтирования (см. комментарий выше) — в обе стороны:
    // появление `employeeId` в пути переключает на "Сотрудник" (переход из отдела/по ссылке), а его
    // исчезновение (например, «Назад к отделу» -> `/salaries`) обязано вернуть обратно на "Отдел" —
    // без этой ветки `scope` оставался бы `'employee'`, и страница продолжала бы показывать отчёт
    // сотрудника при уже сменившемся на `/salaries` URL.
    useEffect(() => {
        if (routeEmployeeId != null) {
            if (selection.scope !== 'employee' || selection.employeeId !== routeEmployeeId) {
                selection.setScope('employee')
                selection.setEmployeeId(routeEmployeeId)
            }
        } else if (selection.scope !== 'department') {
            selection.setScope('department')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeEmployeeId])

    // Дефолт — «Все», а не одно направление: смысл вкладки именно в том, чтобы сразу видеть,
    // сколько отдел получает суммарно, не переключаясь на Сервис/Магазин по отдельности.
    const [directionFilter, setDirectionFilter] = useState<DepartmentDirectionFilter>('all')

    // Клиентский текстовый фильтр по имени сотрудника (Filter Row's Search, `SalaryReportFiltersV2`)
    // — только для отчёта отдела, применяется в `DepartmentLedgerV2` поверх уже загруженного
    // `departmentReport.employees[]` (см. `model/filterEmployeesBySearch.ts`), без нового запроса.
    const [employeeSearch, setEmployeeSearch] = useState('')

    const merged = useDepartmentSalaryReportAll(
        selection.scope === 'department' ? selection.departmentId : null,
        directionFilter,
        selection.period,
    )

    const departmentsQuery = useDepartments()

    useEffect(() => {
        if (selection.departmentId != null) return
        const defaultDepartment = (departmentsQuery.data ?? []).find((department) => department.name === 'Розница')
        if (defaultDepartment) selection.setDepartmentId(defaultDepartment.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departmentsQuery.data, selection.departmentId])

    // Имя/отдел сотрудника для шапки отчёта сотрудника (`EmployeeIdentityHeading`, узлы Pencil
    // `u32Yp`/`w4Eby` — шапка документа начисления, "по аналогии" перенесённая сюда) — контракт
    // отчёта (`EmployeeReportVM`) не отдаёт ни имя, ни отдел сотрудника, только суммы по правилам,
    // поэтому оба резолвятся из того же Bitrix-справочника (`useEmployees`/`useDepartments`,
    // `EmployeeResponse.departmentId`), что раньше питал убранный `Select` выбора сотрудника.
    const employeesQuery = useEmployees()
    const currentEmployee =
        selection.employeeId != null ? (employeesQuery.data ?? []).find((employee) => employee.id === selection.employeeId) ?? null : null
    const employeeName = currentEmployee?.name ?? null
    const employeeDepartmentName =
        currentEmployee != null
            ? ((departmentsQuery.data ?? []).find((department) => department.id === currentEmployee.departmentId)?.name ?? null)
            : null

    const isDepartmentScope = selection.scope === 'department'

    return {
        ...selection,

        direction: directionFilter,
        setDirection: setDirectionFilter,
        employeeSearch,
        setEmployeeSearch,
        departmentReport: isDepartmentScope ? merged.report : null,
        directionBreakdown: isDepartmentScope ? merged.directionBreakdown : null,
        isInitialLoad: isDepartmentScope ? merged.isInitialLoad : selection.isInitialLoad,
        isRefreshing: isDepartmentScope ? merged.isRefreshing : selection.isRefreshing,
        errorMessage: isDepartmentScope ? merged.errorMessage : selection.errorMessage,
        dataVersion: isDepartmentScope ? merged.dataVersion : selection.dataVersion,

        departments: departmentsQuery.data ?? [],
        isDepartmentsLoading: departmentsQuery.isLoading,

        employeeName,
        employeeDepartmentName,
        isEmployeeIdentityLoading: employeesQuery.isLoading,
    }
}

export type SalaryReportPageState = ReturnType<typeof useSalaryReportPage>
