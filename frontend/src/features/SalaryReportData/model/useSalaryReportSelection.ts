import { useState } from 'react'

import { useDepartmentSalaryReport } from './useDepartmentSalaryReport.ts'
import { useEmployeeSalaryReport } from './useEmployeeSalaryReport.ts'
import type { SalaryDirection, SalaryReportScope } from './types.ts'

/** '2026-08' — текущий месяц в формате `YYYY-MM`, который ожидает бэкенд (`PeriodPicker`'s
 * `isValidPeriod`/`shiftPeriod`, `features/SalesPlan/model/format.ts`). Строится из `Date`, а не
 * захардкожен как `DEFAULT_PERIOD` в `features/SalesPlan` — ни одна из двух страниц отчёта не
 * привязана к конкретному демо-периоду, дефолт должен оставаться "сейчас" и после смены месяца в
 * календаре. */
function getCurrentPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Общее состояние отчёта по зарплате (конвенция `useXPage`, плоский объект — см.
 * `frontend/CLAUDE.md`), единственный потребитель — `pages/SalaryReportV2` (`/salaries`). Живёт в
 * `features/SalaryReportData`, а не прямо в странице, по тем же причинам, что и остальной модуль
 * (см. `model/api.ts`'s комментарий) — переиспользуемая инфраструктура отчёта отделена от
 * конкретной вёрстки. Один режим просмотра, переключаемый `scope` — "Сотрудник" делает два
 * параллельных запроса (`useEmployeeSalaryReport`, сведение обоих направлений на фронте), "Отдел"
 * — один запрос на выбранное направление (`useDepartmentSalaryReport`); неактивный для текущего
 * `scope` `id` передаётся вниз как `null`, поэтому его запрос(ы) отключены (`enabled: false`) и не
 * делают лишних сетевых обращений в фоне, пока пользователь смотрит другой режим.
 *
 * НЕ включает справочники сотрудников/отделов (`useDepartments`/`useEmployees`,
 * `@/features/TargetDirectory`) — `features` не может кросс-импортировать другую `features`
 * (`boundaries/dependencies`), поэтому композицию с этими двумя запросами делает страничный
 * `pages/SalaryReportV2/model/useSalaryReportPage.ts` (единственное место, которому разрешено
 * собирать несколько фич вместе), просто разворачивая результат этого хука в свой плоский объект
 * состояния и добавляя `employees`/`departments`.
 *
 * Разворачивание строк правил (в отчёте сотрудника и в отчёте отдела) — общий локальный `Set`-стейт
 * здесь, а не в каждом презентационном компоненте по отдельности: строка идентифицируется собственным
 * `ruleId`, и оба режима используют одну и ту же пару хелперов toggle/isExpanded независимо от
 * текущего `scope`. Строка сотрудника в отчёте отдела (`DepartmentEmployeeGroupV2`) сама по себе НЕ
 * разворачивается — это ссылка на отдельный отчёт сотрудника, а не toggle (см. `SozIO`-редизайн,
 * `docs/salary-department-first-navigation`), поэтому отдельного `Set`-стейта для неё здесь нет.
 *
 * Блоки направлений в карточке-гроссбухе отчёта сотрудника (`LedgerDirectionBlock`) сворачиваются
 * той же общей схемой, но с ИНВЕРТИРОВАННОЙ семантикой `Set`'а — `collapsedDirectionKeys` хранит
 * СВЁРНУТЫЕ направления, а не развёрнутые (в отличие от `expandedRuleKeys` выше). По умолчанию
 * (до первого клика пользователя) "Сервис" свёрнут, а "Магазин" развёрнут — поэтому начальное
 * значение `Set` не пустое, а сразу содержит `'service'` (не общий для обоих направлений дефолт,
 * как было бы с пустым `Set`). Ключ — сам `SalaryDirection` ('service' | 'shop'), без комбинирования
 * с id: направлений всего два, и оба всегда разные в пределах одного отчёта сотрудника.
 *
 * `options.initialScope`/`options.initialEmployeeId` — опциональные начальные значения (по
 * умолчанию `'employee'`/`null`). `pages/SalaryReportV2/model/useSalaryReportPage.ts` передаёт их
 * из `useParams()` роута `/salaries/employee/:employeeId` — переход туда (например, кнопкой
 * «Открыть отчёт» из строки сотрудника в отчёте отдела) должен сразу открывать нужного сотрудника,
 * а не всегда стартовать с пустого режима "Отдел".
 */
export function useSalaryReportSelection(options?: {
    initialScope?: SalaryReportScope
    initialEmployeeId?: number | null
}) {
    const [scope, setScope] = useState<SalaryReportScope>(options?.initialScope ?? 'employee')
    const [period, setPeriod] = useState<string>(getCurrentPeriod)
    const [employeeId, setEmployeeId] = useState<number | null>(options?.initialEmployeeId ?? null)
    const [departmentId, setDepartmentId] = useState<number | null>(null)
    const [direction, setDirection] = useState<SalaryDirection>('service')
    const [expandedRuleKeys, setExpandedRuleKeys] = useState<Set<string>>(new Set())
    const [collapsedDirectionKeys, setCollapsedDirectionKeys] = useState<Set<SalaryDirection>>(
        () => new Set(['service']),
    )

    const employeeReportState = useEmployeeSalaryReport(scope === 'employee' ? employeeId : null, period)
    const departmentReportState = useDepartmentSalaryReport(
        scope === 'department' ? departmentId : null,
        direction,
        period,
    )

    function toggleRule(key: string) {
        setExpandedRuleKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    function isRuleExpanded(key: string) {
        return expandedRuleKeys.has(key)
    }

    function toggleDirection(direction: SalaryDirection) {
        setCollapsedDirectionKeys((prev) => {
            const next = new Set(prev)
            if (next.has(direction)) next.delete(direction)
            else next.add(direction)
            return next
        })
    }

    function isDirectionExpanded(direction: SalaryDirection) {
        return !collapsedDirectionKeys.has(direction)
    }

    const activeReportState = scope === 'employee' ? employeeReportState : departmentReportState

    return {
        scope,
        setScope,
        period,
        setPeriod,
        employeeId,
        setEmployeeId,
        isEmployeeSelected: employeeId != null,
        departmentId,
        setDepartmentId,
        isDepartmentSelected: departmentId != null,
        direction,
        setDirection,

        isInitialLoad: activeReportState.isInitialLoad,
        isRefreshing: activeReportState.isRefreshing,
        errorMessage: activeReportState.errorMessage,
        dataVersion: activeReportState.dataVersion,

        employeeReport: employeeReportState.report,
        departmentReport: departmentReportState.report,

        toggleRule,
        isRuleExpanded,
        toggleDirection,
        isDirectionExpanded,
    }
}

export type SalaryReportSelectionState = ReturnType<typeof useSalaryReportSelection>
