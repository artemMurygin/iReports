// Отклонение от стандартной конвенции index.ts ("реэкспортирует только корневой
// UI-компонент фичи", см. frontend/CLAUDE.md): у этой фичи нет единого корневого
// компонента — страница (pages/SalesPlan) сама собирает несколько независимых
// презентационных кусков (KpiRow, SalesPlanTable) вокруг общего состояния из
// useSalesPlan, аналогично тому, как pages/ServicesReport/mediator оркестрирует
// несколько stateful-виджетов. Поэтому наружу отдаётся весь публичный набор:
// модель + UI + форматтеры, которые нужны и features/SalesPlan/ui, и pages/SalesPlan/ui
// (см. features/SalesPlan/model/format.ts). Уже так было в Фазе 1 (см. её комментарий в
// истории этого файла), Фаза 2 лишь расширяет набор.
export { useSalesPlan, DEFAULT_PERIOD, DEFAULT_DIRECTION, HARDCODED_DEPARTMENT_ID } from './model/useSalesPlan.ts'
export type { SalesPlanRow, SalesPlanTotals } from './model/useSalesPlan.ts'
export { useSalesPlanSelection } from './model/useSalesPlanSelection.ts'
export type { SalesPlanSelection } from './model/useSalesPlanSelection.ts'
export { useApproveSalesPlanRows } from './model/useApproveSalesPlanRows.ts'
export { formatPeriodLabel, isValidPeriod, shiftPeriod } from './model/format.ts'
export { KpiRow } from './ui/KpiRow.tsx'
export { SalesPlanTable } from './ui/SalesPlanTable.tsx'
export { SalesPlanCardList } from './ui/SalesPlanCardList.tsx'
export { SalesPlanEmptyState } from './ui/SalesPlanEmptyState.tsx'
export { SelectionBar } from './ui/SelectionBar.tsx'
export { SelectionBarMobile } from './ui/SelectionBarMobile.tsx'
export { EditPlanModal } from './ui/EditPlanModal.tsx'
export { PeriodPicker } from './ui/PeriodPicker.tsx'
