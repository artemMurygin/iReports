import type { DepartmentReportVM } from '../model/types.ts'

/**
 * Финальный контракт пропсов тела отчёта отдела (Pencil: `b6mfxv`/`d8XFk` — «Отчёт: Зарплата
 * отдела»). Презентационный компонент — вся условная отрисовка живёт внутри
 * `DepartmentReportBody.tsx`, не в мидиаторе/странице (см. `EmployeeReportBody.types.ts`'s
 * комментарий — то же правило).
 */
export type DepartmentReportBodyProps = {
    /** `null`, пока отдел не выбран или отчёт ещё не загрузился (см. `isLoading`/
     * `isDepartmentSelected`). */
    report: DepartmentReportVM | null
    /** `true` во время первичной загрузки (`isInitialLoad` из `useDepartmentSalaryReport`). */
    isLoading: boolean
    /** Сообщение реальной ошибки запроса — `null` в норме. */
    errorMessage: string | null
    /** `false`, пока пользователь не выбрал отдел в фильтрах. */
    isDepartmentSelected: boolean
    /** Развёрнута ли строка сотрудника с данным `employeeId` — при раскрытии показывает его
     * `rules[]` плоской подтаблицей, БЕЗ заказов (`sources[]`), в отличие от отчёта сотрудника. */
    isEmployeeExpanded: (employeeId: number) => boolean
    onToggleEmployee: (employeeId: number) => void
    className?: string
}
