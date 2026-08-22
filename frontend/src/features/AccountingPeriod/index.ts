// Отклонение от конвенции «index.ts реэкспортирует только корневой UI-компонент»
// (frontend/CLAUDE.md) — тот же прецедент, что features/SalesPlan и
// features/TargetDirectory: у фичи нет единого корня, страница плана продаж собирает
// вокруг общего состояния несколько независимых кусков (блок статуса в PageHeader,
// два диалога, дизейбл кнопки по истёкшему месяцу), поэтому наружу отдаётся
// модель + оба диалога.
export { ClosePeriodDialog } from './ui/ClosePeriodDialog/index.ts'
export type { ClosePeriodDialogProps, UnapprovedRowDetails } from './ui/ClosePeriodDialog/index.ts'
export { ReopenPeriodDialog } from './ui/ReopenPeriodDialog.tsx'
export { useAccountingPeriod } from './model/useAccountingPeriod.ts'
export { useClosePeriod, useReopenPeriod } from './model/usePeriodMutations.ts'
export { isPeriodExpired } from './model/periodDates.ts'
export { ACCOUNTING_PERIOD_QUERY_KEY_PREFIX } from './model/api.ts'
export { DIRECTION_LABEL } from './model/labels.ts'
