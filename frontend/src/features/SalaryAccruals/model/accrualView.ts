import type { SalaryAccrual, SalaryAccrualLine, SalaryAccrualStatus } from 'ireports-contracts'

import { ALL_RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'
import { formatNumber, formatSignedCurrency } from '@/shared/lib/format.ts'

import { getSourceTypeLabel, RULE_UNIT_FORMS, RULE_UNIT_PLURAL_LABEL } from './labels.ts'

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

/** «корректировка +700 ₽» — вторая часть меты строки в мобильной карточке (Pencil `g0onp`'s
 * `tZgud`), когда `isLineAdjusted(line)` истинно. Замещает десктопный отдельный `AdjustmentBadge`
 * + зачёркнутое «Было» рядом с суммой — на мобильном для того же факта нет отдельного бейджа, он
 * дописан в мету строки (перепроверено скриншотом `h8et8b`). */
export function formatLineAdjustmentNote(line: Pick<SalaryAccrualLine, 'amount' | 'originalAmount'>): string {
    return `корректировка ${formatSignedCurrency(line.amount - line.originalAmount)}`
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

function pluralizeByForms(count: number, forms: readonly [string, string, string]): string {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return forms[0]
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
    return forms[2]
}

/**
 * «Основание» под суммой строки правила (Pencil `DQ3tV`'s `duUGQ`/`jQeov`: «42 заказа × 8%»,
 * `mP3Ib`: «130 ч × 200 ₽/ч», `fTj0d`: «3 задачи × 1 000 ₽», `V7PRHG`: «фикс за период»).
 * `quantity`/`rate` — реальные поля строки (`calculationLineSchema`), единственное, что добавлено
 * сверх них клиентски, — счётное существительное по `line.type` (`RULE_UNIT_FORMS`) и суффикс
 * «/ч» у почасовой ставки (контракт не отдаёт отдельно единицу измерения ставки, но для
 * `PayPerHour` она всегда часы — тот же вывод, что делает `getRuleRate` в
 * `pages/SalaryReportV2/model/ruleRate.ts` для фиксированной ставки через `sources.length`).
 * Без `quantity` (правило без измеримой базы, например премия за выполнение плана) — «фикс за
 * период», как в макете, а не выдуманное число.
 */
export function formatLineBasisNote(
    line: Pick<SalaryAccrualLine, 'type' | 'quantity' | 'rate' | 'salaryBasis'>,
): string {
    if (line.quantity === undefined) return 'фикс за период'

    const qty = formatNumber(line.quantity)
    if (line.type === 'PayPerHour') {
        return line.rate === undefined ? `${qty} ч` : `${qty} ч × ${line.rate.toLocaleString('ru-RU')} ₽/ч`
    }

    const rate = formatLineRate(line)
    const forms = RULE_UNIT_FORMS[line.type]
    if (forms === undefined) return rate === '—' ? qty : `${qty} × ${rate}`

    const unit = pluralizeByForms(line.quantity, forms)
    return rate === '—' ? `${qty} ${unit}` : `${qty} ${unit} × ${rate}`
}

/**
 * Вторая строка меты строки правила (Pencil `d6CF6L`: «Процент от суммы работ · заказы
 * RemOnline» — тип правила `getRuleTypeLabel` уже отдаёт человекочитаемым, «заказы» отсюда;
 * бренд ERP из макета опущен, см. `RULE_UNIT_PLURAL_LABEL`'s комментарий). Без источников (у
 * `PayPerHour` их обычно нет — часы, не документы ERP) вторая часть не показывается.
 */
export function formatLineMeta(line: Pick<SalaryAccrualLine, 'type' | 'sources'>): string {
    const typeLabel = (ALL_RULE_TYPE_LABELS as Record<string, string>)[line.type] ?? line.type
    if (line.sources.length === 0) return typeLabel

    const unitLabel = RULE_UNIT_PLURAL_LABEL[line.type] ?? getSourceTypeLabel(dominantSourceType(line.sources))
    return `${typeLabel} · ${unitLabel}`
}

function dominantSourceType(sources: SalaryAccrualLine['sources']): string {
    const counts = new Map<string, number>()
    for (const source of sources) counts.set(source.type, (counts.get(source.type) ?? 0) + 1)
    let best = sources[0].type
    let bestCount = 0
    for (const [type, count] of counts) {
        if (count > bestCount) {
            best = type
            bestCount = count
        }
    }
    return best
}

/** Сумма начислений по скрытым (не показанным) источникам строки — «ещё N заказов · 20 744 ₽»
 * (Pencil `CVHtc`/`gEsPs`), не подгонка под один сэмпл: реальная сумма `source.amount` хвоста
 * массива за вычетом видимых. `undefined` у источника без суммы (см. `calculationSourceRefSchema`'s
 * комментарий про опциональность) — не учитывается отдельно, просто не прибавляется. */
export function deriveHiddenSourcesTotal(sources: SalaryAccrualLine['sources'], visibleCount: number): number {
    return sources.slice(visibleCount).reduce((sum, source) => sum + (source.amount ?? 0), 0)
}

// ========================== Итого списка (карточка «Итого») ========================== //

export type AccrualsTotals = {
    /** «К начислению» — сумма `total` по всем документам текущей области (отдел + статус). */
    toAccrueAmount: number
    /** «Начислено на текущий момент» — сумма `total` только документов, начисленных ПОЛНОСТЬЮ
     * (`ACCRUED`/`PAID`). `PARTIALLY_ACCRUED` в эту сумму не входит — контракт списка
     * (`salaryAccrualSchema`) отдаёт `accruedLinesCount`, но не сумму уже проведённых строк, а
     * `total` документа включает и ещё не начисленные строки тоже, так что подставить его сюда
     * значило бы посчитать не начисленное как начисленное. Это осознанное клиентское приближение
     * (частично начисленные документы исключены из числителя, но учтены в знаменателе
     * `totalDocsCount`/пилюле «N из M»), а не выдуманная пропорциональная разбивка — точную сумму
     * такой карточке может отдать только бэкенд, добавляя поле в ответ списка.
     */
    accruedSoFarAmount: number
    /** Документов, начисленных полностью (`ACCRUED`/`PAID`). */
    accruedDocsCount: number
    totalDocsCount: number
}

export function deriveAccrualsTotals(items: SalaryAccrual[]): AccrualsTotals {
    return items.reduce<AccrualsTotals>(
        (acc, item) => {
            const isFullyAccrued = item.status === 'ACCRUED' || item.status === 'PAID'
            return {
                toAccrueAmount: acc.toAccrueAmount + item.total,
                accruedSoFarAmount: acc.accruedSoFarAmount + (isFullyAccrued ? item.total : 0),
                accruedDocsCount: acc.accruedDocsCount + (isFullyAccrued ? 1 : 0),
                totalDocsCount: acc.totalDocsCount + 1,
            }
        },
        { toAccrueAmount: 0, accruedSoFarAmount: 0, accruedDocsCount: 0, totalDocsCount: 0 },
    )
}

// ========================== Фильтр по отделу ========================== //

/** Select «Отдел» (Pencil `LvW0I`'s `wQY20`/`DtPgO`'s `U50So`) в Scope Controls — `null` («Все
 * отделы») пропускает список без изменений. */
export function filterAccrualsByDepartment(items: SalaryAccrual[], departmentId: number | null): SalaryAccrual[] {
    if (departmentId === null) return items
    return items.filter((item) => item.departmentId === departmentId)
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
