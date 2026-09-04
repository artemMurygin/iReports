import type { SalaryAccrualStatus, SalesDirection } from 'ireports-contracts'

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
