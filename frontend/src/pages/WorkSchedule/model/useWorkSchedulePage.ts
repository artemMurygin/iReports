import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { arrayMove } from '@dnd-kit/sortable'
import { useSearchParams } from 'react-router-dom'
import type { MonthlyWorkScheduleResponse } from 'ireports-contracts'

import { useDepartments, useEmployees } from '@/features/TargetDirectory'

import { api } from './api.ts'
import { parseHighlightedEmployeeId } from './employeeHighlight.ts'
import { formatFullDateLabel, formatMonthLabel, getCurrentMonthIso, getTodayIso, isValidMonth } from './format.ts'
import { buildReorderPayload } from './reorderEmployeesPayload.ts'
import { buildMonthDays } from './scheduleDays.ts'
import type { WorkScheduleTab } from './tabs.ts'
import { useReorderEmployees } from './useReorderEmployees.ts'

// Стабильная ссылка для «данные ещё не пришли» — `data?.employees ?? []` создавал бы новый пустой
// массив на каждый рендер, из-за чего `useMemo` ниже (`employees`, зависящий от `baseEmployees`)
// считал бы её меняющейся зависимостью и пересчитывался на каждый рендер впустую
// (react-hooks/exhaustive-deps). Массив только для чтения — сюда никогда не пушат.
const EMPTY_EMPLOYEES: MonthlyWorkScheduleResponse['employees'] = []

/**
 * Владеет всем состоянием страницы «График работы»: выбранный месяц/отдел/вкладка, запрос месяца
 * (`useWorkSchedulePage` — плоский объект по тому же соглашению, что и `useSalesPlanPage`/
 * `useServicesAnalytics`, см. frontend/CLAUDE.md), справочник отделов для фильтра и список
 * календарных дней месяца (`buildMonthDays`, общий для шапки/строк/подвала таблицы).
 *
 * `todayIso` вычисляется один раз при монтировании (`useState` с инициализатором, а не
 * пересчитывается на каждый рендер) — «сегодня» не должно скакать в рамках одной открытой
 * страницы, а полночь посреди сессии — не тот сценарий, ради которого стоит городить таймер.
 *
 * `tab` — свой независимый `useState`, а не третий параметр запроса: вкладки «Календарь»/«Роли»
 * рендерят одни и те же `employees`/`days` месяца (план, Фаза 8 — «данные берутся из того же GET
 * /v1/work-schedule … отдельный запрос не нужен»), поэтому переключение вкладки не должно
 * перезапускать `useQuery` и, соответственно, не может само по себе сбросить `month`/`departmentId`.
 *
 * `month`/`highlightedEmployeeId` читают query-параметры `?month=&employeeId=` один раз при
 * монтировании (`useState`-инициализатор, тот же приём, что и у `todayIso`) — это вход со стороны
 * мобильного экрана «Отдел сегодня» (план, Фаза 9: «Переход с карточки сотрудника на его график»,
 * см. `pages/WorkScheduleToday/model/employeeScheduleLink.ts`), а не состояние, которому нужно
 * следить за URL после открытия страницы: руководитель может свободно листать месяцы дальше, не
 * дёргая назад к тому, с которого пришёл переход.
 */
export function useWorkSchedulePage() {
    const [searchParams] = useSearchParams()
    const [month, setMonth] = useState<string>(() => {
        const fromQuery = searchParams.get('month')
        return fromQuery && isValidMonth(fromQuery) ? fromQuery : getCurrentMonthIso()
    })
    const [highlightedEmployeeId] = useState<number | null>(() =>
        parseHighlightedEmployeeId(searchParams.get('employeeId')),
    )
    // `undefined` — фильтр ещё не тронут руководителем (дефолт — отдел «Розница», как только
    // подгрузится справочник), `null` — руководитель осознанно выбрал «все» (см. `effectiveDepartmentId`
    // ниже); два состояния не могут делить одно значение `null`, иначе выбор «все» после дефолта
    // был бы неотличим от «дефолт ещё не применён» и тут же откатывался обратно на «Розница».
    const [departmentId, setDepartmentId] = useState<number | null | undefined>(undefined)
    const [tab, setTab] = useState<WorkScheduleTab>('CALENDAR')
    const [todayIso] = useState<string>(getTodayIso)

    const departmentsQuery = useDepartments()
    const departments = departmentsQuery.data ?? []

    // Дефолт фильтра отдела — «Розница», выведенный, а не выставленный императивно через
    // `setState` в эффекте (react-hooks/set-state-in-effect): пока справочник не загружен, id ещё
    // нет и `effectiveDepartmentId` останется `null` («все») до следующего рендера с данными —
    // одним и тем же способом что для первого рендера, что после того, как отдел найдётся.
    const defaultDepartmentId = departments.find((department) => department.name === 'Розница')?.id ?? null
    const effectiveDepartmentId = departmentId === undefined ? defaultDepartmentId : departmentId

    // placeholderData: keepPreviousData — переключение месяца/отдела не схлопывает уже
    // отрисованную таблицу в спиннер (см. frontend/CLAUDE.md, "isInitialLoad / isRefreshing").
    const {
        data,
        isFetching,
        error: queryError,
        dataUpdatedAt,
    } = useQuery({ ...api.getMonthlySchedule(month, effectiveDepartmentId), placeholderData: keepPreviousData })

    const baseEmployees = data?.employees ?? EMPTY_EMPLOYEES
    const days = useMemo(() => buildMonthDays(month, todayIso), [month, todayIso])

    // ── Drag-n-drop сотрудников (Фаза 2, docs/employee-ordering-and-salary-filter) ──────────
    // Локальный оптимистичный оверрайд видимого порядка: dnd-kit сам анимирует перетаскиваемую
    // строку в её новое место во время самого жеста, но БЕЗ немедленной правки исходного массива
    // (`baseEmployees`) строка после `onDragEnd` откатилась бы обратно в старую позицию до тех
    // пор, пока не долетит рефетч `PATCH .../employees/order` — заметный "прыжок". `orderOverride`
    // хранит id сотрудников в перетащенном порядке и накладывается на `baseEmployees` в
    // `applyEmployeeOrderOverride` ниже, зафиксированный сразу в `handleReorderEmployees`.
    //
    // Сбрасывается при смене месяца/отдела через сравнение "во время рендера" (тот же приём, что
    // `useEditPlanForm`'s `wasOpen`/`useWorkSchedulePage`'s собственный `todayIso`, вместо
    // `useEffect`+`setState`, см. frontend/CLAUDE.md): черновой оверрайд другого месяца/отдела не
    // должен просачиваться в новый запрос. Также снимается самим `handleReorderEmployees` в
    // `onSuccess`/`onError` мутации — см. её и `useReorderEmployees`'s комментарии, почему именно
    // там, а не сразу по `onDragEnd`.
    const scopeKey = `${month}:${effectiveDepartmentId ?? 'all'}`
    const [orderOverride, setOrderOverride] = useState<number[] | null>(null)
    const [lastScopeKey, setLastScopeKey] = useState(scopeKey)
    if (scopeKey !== lastScopeKey) {
        setLastScopeKey(scopeKey)
        setOrderOverride(null)
    }

    const employees = useMemo(
        () => applyEmployeeOrderOverride(baseEmployees, orderOverride),
        [baseEmployees, orderOverride],
    )

    // Полный, не отфильтрованный по отделу справочник (тот же кэш, что питает `pages/SalaryRules`'
    // выбор сотрудника/`pages/SalaryReportV2`/`pages/EmployeeBalance`, см. `useReorderEmployees`'s
    // комментарий) — нужен `buildReorderPayload`, чтобы корректно пересчитать `order` даже когда
    // таблица графика показывает только ОДИН отфильтрованный отдел (см. её собственный комментарий).
    const allEmployeesQuery = useEmployees()
    const reorderEmployeesMutation = useReorderEmployees()
    // Перетаскивание недоступно, пока полный справочник ещё не загрузился — без него
    // `buildReorderPayload` не может безопасно посчитать `order` (см. её комментарий).
    const canReorderEmployees = (allEmployeesQuery.data?.length ?? 0) > 0

    function handleReorderEmployees(activeEmployeeId: number, overEmployeeId: number) {
        if (activeEmployeeId === overEmployeeId) return
        const currentIds = employees.map((employee) => employee.employeeId)
        const oldIndex = currentIds.indexOf(activeEmployeeId)
        const newIndex = currentIds.indexOf(overEmployeeId)
        if (oldIndex === -1 || newIndex === -1) return

        const newVisibleOrderIds = arrayMove(currentIds, oldIndex, newIndex)

        const fullOrderIds = (allEmployeesQuery.data ?? []).map((employee) => employee.id)
        const items = buildReorderPayload(fullOrderIds, newVisibleOrderIds)
        // Пустой payload означает, что полный справочник (`allEmployeesQuery.data`) не совпадает с
        // видимым подмножеством (гонка загрузки/рассинхронизация) — не применяем локальный
        // оверрайд вовсе, а не оставляем его висеть непереживающим сохранение (`canReorderEmployees`
        // не даёт этой ветке случиться в обычном сценарии, см. её комментарий).
        if (items.length === 0) return

        setOrderOverride(newVisibleOrderIds)
        reorderEmployeesMutation.mutate(
            { items },
            {
                // Успех: `useReorderEmployees`'s onSuccess уже дождался (await) свежих данных —
                // локальный оверрайд можно снять без "мигания" обратно в старый порядок. Ошибка:
                // сервер не сохранил перестановку — откатываем локальный оверрайд к тому, что
                // реально лежит на бэкенде (toast уже показан внутри `useReorderEmployees`).
                onSuccess: () => setOrderOverride(null),
                onError: () => setOrderOverride(null),
            },
        )
    }

    const isInitialLoad = isFetching && data === undefined
    const isRefreshing = isFetching && !isInitialLoad

    return {
        month,
        setMonth,
        departmentId: effectiveDepartmentId,
        setDepartmentId,
        tab,
        setTab,
        highlightedEmployeeId,
        departments,
        isDepartmentsLoading: departmentsQuery.isLoading,
        days,
        employees,
        dayAggregates: data?.days ?? [],
        totalHours: data?.totalHours ?? 0,
        hasData: employees.length > 0,
        periodLabel: formatMonthLabel(month),
        todayLabel: formatFullDateLabel(todayIso),
        isInitialLoad,
        isRefreshing,
        dataVersion: dataUpdatedAt,
        error: queryError?.message ?? null,
        canReorderEmployees,
        onReorderEmployees: handleReorderEmployees,
    }
}

/** Применяет локальный drag-n-drop оверрайд (`orderOverride`, id сотрудников в новом порядке)
 * поверх `employees`, пришедших с бэкенда — тот же приём "неизвестная позиция уходит в конец",
 * что и `EditPlanModal`'s `applyDraftOrder` (см. её комментарий), адаптированный к тому, что здесь
 * оверрайд снимается сразу после подтверждения мутации, а не хранится до отдельного "Сохранить". */
function applyEmployeeOrderOverride(
    employees: MonthlyWorkScheduleResponse['employees'],
    orderOverride: number[] | null,
): MonthlyWorkScheduleResponse['employees'] {
    if (!orderOverride) return employees
    const byId = new Map(employees.map((employee) => [employee.employeeId, employee]))
    const ordered = orderOverride
        .map((employeeId) => byId.get(employeeId))
        .filter((employee): employee is MonthlyWorkScheduleResponse['employees'][number] => employee !== undefined)
    const orderedIdSet = new Set(orderOverride)
    const missing = employees.filter((employee) => !orderedIdSet.has(employee.employeeId))
    return [...ordered, ...missing]
}
