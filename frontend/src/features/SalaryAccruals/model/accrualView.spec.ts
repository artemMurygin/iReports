import { describe, expect, it } from 'vitest'
import type { SalaryAccrual, SalaryAccrualLine } from 'ireports-contracts'

import {
    countAdjustedLines,
    countByStatus,
    deriveAccrualsTotals,
    deriveDocumentProgress,
    deriveListProgress,
    employeeInitials,
    filterAccruals,
    filterAccrualsByDepartment,
    formatLineRate,
    isLineAdjusted,
    pluralizeLines,
} from './accrualView.ts'

// «Компонентные тесты таблицы (статусы, прогресс, корректировка с зачёркнутой суммой)» из
// Фазы 5 — как и в Фазе 4 (deriveCloseDialogState), в проекте нет jsdom/testing-library,
// поэтому все ветвления таблицы/карточек выведены в чистые производные accrualView.ts и
// тестируются здесь.

function accrual(overrides: Partial<SalaryAccrual> = {}): SalaryAccrual {
    return {
        id: 'a1',
        direction: 'service',
        period: '2026-06',
        employeeId: 1,
        employeeName: 'Ковалёв Артём',
        departmentId: 160,
        status: 'DRAFT',
        isDismissed: false,
        total: 10_000,
        linesCount: 3,
        accruedLinesCount: 0,
        createdAt: new Date('2026-07-01T10:00:00Z'),
        ...overrides,
    }
}

function line(overrides: Partial<SalaryAccrualLine> = {}): SalaryAccrualLine {
    return {
        id: 'l1',
        ruleId: 'r1',
        type: 'OrderPayed',
        name: 'Ремонт · процент от работ',
        targetRole: 'ENGINEER',
        amount: 24_800,
        originalAmount: 24_800,
        status: 'DRAFT',
        sources: [],
        adjustmentComment: null,
        ...overrides,
    }
}

describe('deriveListProgress (статусы -> прогресс строки списка)', () => {
    it('DRAFT -> 0 из N, пустая полоса', () => {
        expect(deriveListProgress('DRAFT', 5)).toEqual({
            accruedCount: 0,
            totalCount: 5,
            percent: 0,
            label: '0 из 5',
        })
    })

    it('ACCRUED и PAID -> N из N, полная полоса', () => {
        expect(deriveListProgress('ACCRUED', 4)).toEqual({
            accruedCount: 4,
            totalCount: 4,
            percent: 100,
            label: '4 из 4',
        })
        expect(deriveListProgress('PAID', 2).percent).toBe(100)
        expect(deriveListProgress('PAID', 2).label).toBe('2 из 2')
    })

    it('PARTIALLY_ACCRUED -> точное число неизвестно списку («— из N», полоса наполовину)', () => {
        expect(deriveListProgress('PARTIALLY_ACCRUED', 4)).toEqual({
            accruedCount: null,
            totalCount: 4,
            percent: 50,
            label: '— из 4',
        })
    })
})

describe('deriveDocumentProgress (точный прогресс по строкам карточки)', () => {
    it('считает начисленными строки не в DRAFT (ACCRUED и PAID)', () => {
        const progress = deriveDocumentProgress([
            line({ status: 'ACCRUED' }),
            line({ id: 'l2', status: 'PAID' }),
            line({ id: 'l3', status: 'DRAFT' }),
            line({ id: 'l4', status: 'DRAFT' }),
        ])
        expect(progress).toEqual({ accruedCount: 2, totalCount: 4, percent: 50, label: '2 из 4' })
    })

    it('пустой документ -> 0 из 0 без деления на ноль', () => {
        expect(deriveDocumentProgress([])).toEqual({ accruedCount: 0, totalCount: 0, percent: 0, label: '0 из 0' })
    })
})

describe('isLineAdjusted (корректировка с зачёркнутой суммой)', () => {
    it('amount != originalAmount -> строка скорректирована (исходная сумма зачёркивается)', () => {
        expect(isLineAdjusted(line({ amount: 9_600, originalAmount: 8_900 }))).toBe(true)
    })

    it('amount == originalAmount -> без зачёркивания', () => {
        expect(isLineAdjusted(line())).toBe(false)
    })

    it('countAdjustedLines считает только разошедшиеся строки', () => {
        expect(
            countAdjustedLines([line(), line({ id: 'l2', amount: 100, originalAmount: 200 }), line({ id: 'l3' })]),
        ).toBe(1)
    })
})

describe('formatLineRate (ставка: процент vs деньги)', () => {
    it('строка с salaryBasis (процентное правило) -> «8%»', () => {
        expect(formatLineRate(line({ rate: 8, salaryBasis: 'REVENUE' }))).toBe('8%')
    })

    it('строка без salaryBasis (фикс/почасовая) -> «200 ₽»', () => {
        expect(formatLineRate(line({ rate: 200 }))).toBe('200 ₽')
    })

    it('без ставки -> «—»', () => {
        expect(formatLineRate(line())).toBe('—')
    })
})

describe('deriveAccrualsTotals (карточка «Итого»)', () => {
    it('«К начислению» — сумма total всех документов; «Начислено» — только ACCRUED/PAID', () => {
        const totals = deriveAccrualsTotals([
            accrual({ id: 'a1', total: 10_000, status: 'DRAFT' }),
            accrual({ id: 'a2', total: 20_000, status: 'ACCRUED' }),
            accrual({ id: 'a3', total: 30_000, status: 'PARTIALLY_ACCRUED' }),
            accrual({ id: 'a4', total: 40_000, status: 'PAID' }),
        ])

        expect(totals).toEqual({
            toAccrueAmount: 100_000,
            // PARTIALLY_ACCRUED (a3) сознательно исключён из числителя — точная сумма по
            // проведённым строкам такого документа на уровне списка недоступна.
            accruedSoFarAmount: 60_000,
            accruedDocsCount: 2,
            totalDocsCount: 4,
        })
    })

    it('пустой список -> все поля 0', () => {
        expect(deriveAccrualsTotals([])).toEqual({
            toAccrueAmount: 0,
            accruedSoFarAmount: 0,
            accruedDocsCount: 0,
            totalDocsCount: 0,
        })
    })
})

describe('filterAccrualsByDepartment (Select «Отдел» в Scope Controls)', () => {
    const items = [
        accrual({ id: 'a1', departmentId: 160 }),
        accrual({ id: 'a2', departmentId: 161 }),
        accrual({ id: 'a3', departmentId: null }),
    ]

    it('null («Все отделы») -> список без изменений', () => {
        expect(filterAccrualsByDepartment(items, null)).toEqual(items)
    })

    it('фильтрует по id отдела', () => {
        expect(filterAccrualsByDepartment(items, 160).map((i) => i.id)).toEqual(['a1'])
    })

    it('документ без отдела не попадает ни под один конкретный id', () => {
        expect(filterAccrualsByDepartment(items, 999)).toHaveLength(0)
    })
})

describe('filterAccruals и countByStatus (фильтр-чипы и поиск)', () => {
    const items = [
        accrual({ id: 'a1', status: 'DRAFT', employeeName: 'Ковалёв Артём' }),
        accrual({ id: 'a2', status: 'ACCRUED', employeeName: 'Никитин Максим' }),
        accrual({ id: 'a3', status: 'DRAFT', employeeName: 'Смирнова Ольга' }),
    ]

    it('фильтрует по статусу; ALL возвращает всё', () => {
        expect(filterAccruals(items, 'DRAFT', '').map((i) => i.id)).toEqual(['a1', 'a3'])
        expect(filterAccruals(items, 'ALL', '')).toHaveLength(3)
        expect(filterAccruals(items, 'PAID', '')).toHaveLength(0)
    })

    it('поиск по ФИО — регистронезависимое вхождение, поверх фильтра статуса', () => {
        expect(filterAccruals(items, 'ALL', 'никитин').map((i) => i.id)).toEqual(['a2'])
        expect(filterAccruals(items, 'DRAFT', 'ольга').map((i) => i.id)).toEqual(['a3'])
        expect(filterAccruals(items, 'ACCRUED', 'ольга')).toHaveLength(0)
    })

    it('countByStatus считает документы под каждый чип', () => {
        expect(countByStatus(items)).toEqual({ ALL: 3, DRAFT: 2, PARTIALLY_ACCRUED: 0, ACCRUED: 1, PAID: 0 })
    })
})

describe('вспомогательные', () => {
    it('employeeInitials — первые буквы первых двух слов', () => {
        expect(employeeInitials('Ковалёв Артём')).toBe('КА')
        expect(employeeInitials('Фомина')).toBe('Ф')
        expect(employeeInitials('  ')).toBe('')
    })

    it('pluralizeLines — русские формы', () => {
        expect(pluralizeLines(1)).toBe('строка')
        expect(pluralizeLines(3)).toBe('строки')
        expect(pluralizeLines(5)).toBe('строк')
        expect(pluralizeLines(11)).toBe('строк')
    })
})
