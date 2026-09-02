import type { SalaryAccrualStatus, SalesDirection, TaskRuleStatus } from 'ireports-contracts'

/** «Сервис»/«Магазин» — те же подписи, что у Direction Tabs плана продаж. */
export const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

/** «из RemOnline» / «из МойСклада» — для подзаголовка и alert'ов диалога закрытия
 * (Pencil `GUo20`: «Данные будут дотянуты из RemOnline…»). Хранится сразу с предлогом,
 * потому что «МойСклад» склоняется, а «RemOnline» — нет. */
export const DIRECTION_ERP_FROM: Record<SalesDirection, string> = {
    service: 'из RemOnline',
    shop: 'из МойСклада',
}

/** Подписи статусов документа начисления (PRD 1/2: Черновик → … → Выплачено) —
 * используются перечнем документов не в «Черновике» в диалоге переоткрытия. */
export const ACCRUAL_STATUS_LABEL: Record<SalaryAccrualStatus, string> = {
    DRAFT: 'Черновик',
    PARTIALLY_ACCRUED: 'Частично начислено',
    ACCRUED: 'Ожидает выплаты',
    PAID: 'Выплачено',
}

/** Статусы задачи Bitrix24 правила-задачи (change salary-rule-bitrix-task, design.md Decision 6) —
 * та же копия, что `features/SalaryReportData/model/labels.ts`'s `TASK_RULE_STATUS_LABELS`, не
 * реэкспорт: `features` не может кросс-импортировать другую `features` (`boundaries/dependencies`,
 * `frontend/CLAUDE.md`). Используется перечнем незакрытых задач в диалоге закрытия месяца. */
export const TASK_RULE_STATUS_LABEL: Record<TaskRuleStatus, string> = {
    PENDING: 'Ждёт выполнения',
    IN_PROGRESS: 'Выполняется',
    COMPLETED: 'Завершена',
}
