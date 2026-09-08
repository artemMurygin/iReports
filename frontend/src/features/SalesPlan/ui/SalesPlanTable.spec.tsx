import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { SalesPlanResponse } from 'ireports-contracts'

import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'

import { SalesPlanTable } from './SalesPlanTable.tsx'

function makeRow(id: string, category: string): SalesPlanRow {
    const plan: SalesPlanResponse = {
        id,
        direction: 'service',
        department: 160,
        category,
        period: '2026-09',
        turnover: 100000,
        margin: 20000,
        orderTypeIds: [],
        source: 'MANUAL',
        status: 'CREATED',
        approvedBy: null,
        approvedAt: null,
        sortOrder: null,
        createdAt: new Date('2026-09-01'),
        updatedAt: new Date('2026-09-01'),
    }
    return {
        direction: 'service',
        period: '2026-09',
        department: 160,
        category,
        plan,
        fact: { turnover: 0, margin: 0, marginPercent: 0, cost: 0, quantity: 0, averageCheck: 0, percentCompletion: 0 },
        prognose: { turnover: 0, margin: 0, marginPercent: 0, quantity: 0, percentCompletion: 0 },
        categoryName: category,
        remaining: plan.turnover,
        remainingMargin: plan.margin,
        marginPercent: 0,
        orderTypeNames: [],
    }
}

/**
 * `SalesPlanTable` — read-only, keyed by `row.plan.id`; Фаза 3 (docs/sales-plan-row-drag-and-drop-
 * reorder) требует, чтобы она рендерила строки строго в порядке входного массива `rows`
 * (пришедшего от API/`useSalesPlan`, уже отсортированного по `sortOrder` на бэкенде), без
 * собственной пересортировки. Проверяется намеренно "неотсортированным" (не по алфавиту, не по id)
 * порядком строк — так тест ловит любую скрытую клиентскую сортировку.
 */
describe('SalesPlanTable — рендерит строки в порядке входного массива, без своей сортировки (Фаза 3)', () => {
    it('DOM-порядок названий категорий совпадает с порядком rows', () => {
        const rows = [makeRow('plan-z', 'cat-z'), makeRow('plan-a', 'cat-a'), makeRow('plan-m', 'cat-m')]
        const { container } = render(
            <SalesPlanTable
                rows={rows}
                selectedIds={new Set()}
                onToggleRow={vi.fn()}
                onToggleAll={vi.fn()}
                isAllSelected={false}
                isIndeterminate={false}
            />,
        )

        const rowNodes = container.querySelectorAll('[data-slot="sales-plan-table-row"]')
        expect(rowNodes).toHaveLength(3)
        const categoryNames = [...rowNodes].map((node) => node.querySelector('span')?.textContent)
        expect(categoryNames).toEqual(['cat-z', 'cat-a', 'cat-m'])
    })
})
