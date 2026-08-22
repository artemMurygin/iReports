import type { SalaryAccrual, SalaryAccrualLine, SalaryAccrualStatus } from 'ireports-contracts'

/**
 * Чистые производные для страниц списка начислений и документа (Фаза 5
 * docs/payroll-closing-and-accrual). Все ветвления таблиц/карточек (статусы, прогресс,
 * зачёркнутая сумма корректировки) выведены сюда и покрыты vitest-тестами
 * (accrualView.spec.ts) — тот же приём, что deriveCloseDialogState в
 * features/AccountingPeriod (в проекте нет jsdom/testing-library, поэтому «компонентные
 * тесты таблицы» — это тесты её model-производных).
 */

// ========================== Прогресс начисления ========================== //

export type AccrualProgress = {
    /** Число начисленных строк; `null` — точное число неизвестно (см. deriveListProgress). */
    accruedCount: number | null
    totalCount: number
    /** Заполнение полосы прогресса, 0–100. */
    percent: number
    /** «3 из 5» / «— из 4» — готовая подпись для ячейки/карточки. */
    label: string
}

/**
 * Прогресс для СТРОКИ СПИСКА — у `SalaryAccrual` есть только `linesCount` и статус
 * документа, без числа начисленных строк, поэтому прогресс выводится из статуса:
 * `DRAFT` — 0, `ACCRUED`/`PAID` — все. Для `PARTIALLY_ACCRUED` точное число знает
 * только карточка (см. deriveDocumentProgress) — список показывает полосу наполовину
 * и «— из N»; в данных Фазы 5 (до мутаций Фазы 9) все документы — `DRAFT`, а точный
 * счётчик в списке появится, когда бэкенд Фазы 6 начнёт отдавать его в ответе списка.
 */
export function deriveListProgress(status: SalaryAccrualStatus, linesCount: number): AccrualProgress {
    if (status === 'DRAFT') {
        return { accruedCount: 0, totalCount: linesCount, percent: 0, label: `0 из ${linesCount}` }
    }
    if (status === 'PARTIALLY_ACCRUED') {
        return { accruedCount: null, totalCount: linesCount, percent: 50, label: `— из ${linesCount}` }
    }
    return {
        accruedCount: linesCount,
        totalCount: linesCount,
        percent: 100,
        label: `${linesCount} из ${linesCount}`,
    }
}

/** Прогресс для КАРТОЧКИ документа — точный счёт по статусам строк (не `DRAFT` — начислена). */
export function deriveDocumentProgress(lines: SalaryAccrualLine[]): AccrualProgress {
    const accruedCount = lines.filter((line) => line.status !== 'DRAFT').length
    const totalCount = lines.length

    return {
        accruedCount,
        totalCount,
        percent: totalCount === 0 ? 0 : (accruedCount / totalCount) * 100,
        label: `${accruedCount} из ${totalCount}`,
    }
}

// ========================== Корректировка строки ========================== //

/** `amount` разошёлся с `originalAmount` (корректировка PRD 2) — UI показывает исходную
 * сумму зачёркнутой рядом с действующей (Pencil `jb7fL`, строка «Продажа аксессуаров»). */
export function isLineAdjusted(line: Pick<SalaryAccrualLine, 'amount' | 'originalAmount'>): boolean {
    return line.amount !== line.originalAmount
}

export function countAdjustedLines(lines: SalaryAccrualLine[]): number {
    return lines.filter(isLineAdjusted).length
}

// ========================== Ставка строки ========================== //

/**
 * «8%» / «200 ₽» / «—»: у процентных правил строка расчёта несёт `salaryBasis`
 * (см. calculationLineSchema — базу заполняют только процентные награды), поэтому её
 * наличие и различает процентную ставку от денежной (PayPerHour/Fixed).
 */
export function formatLineRate(line: Pick<SalaryAccrualLine, 'rate' | 'salaryBasis'>): string {
    if (line.rate === undefined) return '—'
    const rate = line.rate.toLocaleString('ru-RU')
    return line.salaryBasis !== undefined ? `${rate}%` : `${rate} ₽`
}

// ========================== Сводка KPI списка ========================== //

export type AccrualsSummary = {
    /** Фонд оплаты — сумма `total` всех документов. */
    totalAmount: number
    employeesCount: number
    dismissedCount: number
    draftCount: number
    draftAmount: number
    /** `ACCRUED` — «Ожидает выплаты». */
    awaitingCount: number
    awaitingAmount: number
}

export function deriveAccrualsSummary(items: SalaryAccrual[]): AccrualsSummary {
    return items.reduce<AccrualsSummary>(
        (acc, item) => ({
            totalAmount: acc.totalAmount + item.total,
            employeesCount: acc.employeesCount + 1,
            dismissedCount: acc.dismissedCount + (item.isDismissed ? 1 : 0),
            draftCount: acc.draftCount + (item.status === 'DRAFT' ? 1 : 0),
            draftAmount: acc.draftAmount + (item.status === 'DRAFT' ? item.total : 0),
            awaitingCount: acc.awaitingCount + (item.status === 'ACCRUED' ? 1 : 0),
            awaitingAmount: acc.awaitingAmount + (item.status === 'ACCRUED' ? item.total : 0),
        }),
        {
            totalAmount: 0,
            employeesCount: 0,
            dismissedCount: 0,
            draftCount: 0,
            draftAmount: 0,
            awaitingCount: 0,
            awaitingAmount: 0,
        },
    )
}

// ========================== Фильтр по статусу и поиск ========================== //

export type AccrualStatusFilter = 'ALL' | SalaryAccrualStatus

export const STATUS_FILTERS: readonly AccrualStatusFilter[] = ['ALL', 'DRAFT', 'PARTIALLY_ACCRUED', 'ACCRUED', 'PAID']

export function countByStatus(items: SalaryAccrual[]): Record<AccrualStatusFilter, number> {
    const counts: Record<AccrualStatusFilter, number> = {
        ALL: items.length,
        DRAFT: 0,
        PARTIALLY_ACCRUED: 0,
        ACCRUED: 0,
        PAID: 0,
    }
    for (const item of items) counts[item.status] += 1
    return counts
}

/** Фильтр-чипы по статусу + поиск по ФИО (регистронезависимое вхождение, Pencil `cfNlL`
 * «Поиск по сотруднику»). */
export function filterAccruals(items: SalaryAccrual[], status: AccrualStatusFilter, search: string): SalaryAccrual[] {
    const query = search.trim().toLocaleLowerCase('ru-RU')

    return items.filter((item) => {
        if (status !== 'ALL' && item.status !== status) return false
        if (query !== '' && !item.employeeName.toLocaleLowerCase('ru-RU').includes(query)) return false
        return true
    })
}

// ========================== Инициалы аватара ========================== //

/** «Ковалёв Артём» -> «КА» — инициалы для Avatar (первые буквы первых двух слов ФИО). */
export function employeeInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter((part) => part.length > 0)
        .slice(0, 2)
        .map((part) => part[0].toLocaleUpperCase('ru-RU'))
        .join('')
}

// ========================== Плюрализация ========================== //

/** 1 -> 'строка', 2 -> 'строки', 5/11 -> 'строк'. */
export function pluralizeLines(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) return 'строка'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'строки'
    return 'строк'
}

/** 1 -> 'правило', 2 -> 'правила', 5/11 -> 'правил' — подпись «N правил» в списке. */
export function pluralizeRulesCount(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) return 'правило'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'правила'
    return 'правил'
}

/** 1 -> 'источник', 2 -> 'источника', 5/11 -> 'источников' — «Показать все N источников». */
export function pluralizeSources(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) return 'источник'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'источника'
    return 'источников'
}

/** 1 -> 'документа', N -> 'документов' — «Показано N из M документов». */
export function pluralizeDocuments(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) return 'документ'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'документа'
    return 'документов'
}
