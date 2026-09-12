import type { SalesDirection } from 'ireports-contracts'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 29 — короткий человекочитаемый лейбл для
 * `SalaryRuleSummaryCard`. `DIRECTION_LABEL` уже существует как локальная карта в другом месте
 * (`TaskStatusCard.tsx`), но кросс-импорт между `features/*` запрещён линтингом
 * (frontend/CLAUDE.md), поэтому здесь — собственная копия (та же локальная константа рядом с
 * местом использования, а не общий модуль ради одной маленькой карты).
 */
export const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Шоп',
}
