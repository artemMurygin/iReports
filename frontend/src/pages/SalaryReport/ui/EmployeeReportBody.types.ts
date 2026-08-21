import type { EmployeeReportVM } from '../model/types.ts'

/**
 * Финальный контракт пропсов тела отчёта сотрудника (Pencil: `t3QCM`/`Z0lgF` — «Зарплата
 * сотрудника»). Презентационный компонент — вся условная отрисовка (пусто/загрузка/ошибка/
 * закрытый период/готовые данные) живёт внутри `EmployeeReportBody.tsx`, а не в
 * `SalaryReportPage`/`useSalaryReportPage` (правило «медиатор без `&&`/тернарников»,
 * `frontend/CLAUDE.md`).
 */
export type EmployeeReportBodyProps = {
    /** Сведённый отчёт по обоим направлениям — `null`, пока сотрудник не выбран или отчёт ещё не
     * загрузился (см. `isLoading`/`isEmployeeSelected` для различения этих состояний). */
    report: EmployeeReportVM | null
    /** `true` во время первичной загрузки (`isInitialLoad` из `useEmployeeSalaryReport`) — НЕ
     * фонового рефетча, тот покрывается `RefreshTransitionLayout` на уровне страницы. */
    isLoading: boolean
    /** Сообщение реальной ошибки запроса (сеть/5xx) — `null` в норме. 404 отдельного направления
     * уже отфильтрован на уровне `model/api.ts`/`useEmployeeSalaryReport` и сюда не долетает. */
    errorMessage: string | null
    /** `false`, пока пользователь не выбрал сотрудника в фильтрах — отличает "пусто, потому что
     * ничего не выбрано" от "пусто, потому что оба направления вернули 404". */
    isEmployeeSelected: boolean
    /** Развёрнута ли строка правила с данным ключом (`ruleId`, либо `${direction}:${ruleId}`,
     * если один и тот же `ruleId` теоретически может повторяться между направлениями — решает
     * сам компонент при простановке ключей). */
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
    className?: string
}
