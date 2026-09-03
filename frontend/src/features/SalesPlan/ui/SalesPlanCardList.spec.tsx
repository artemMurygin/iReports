import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SalesPlanResponse } from 'ireports-contracts'

import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'

import { SalesPlanCardList } from './SalesPlanCardList.tsx'

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
 * `SalesPlanCardList` — мобильный аналог `SalesPlanTable`, тоже read-only и обязан следовать
 * тому же порядку `rows`, что и десктопная таблица (Фаза 3, docs/sales-plan-row-drag-and-drop-
 * reorder). Тот же приём — намеренно "неалфавитный" порядок входных строк, чтобы поймать любую
 * скрытую клиентскую сортировку.
 */
describe('SalesPlanCardList — рендерит карточки в порядке входного массива, без своей сортировки (Фаза 3)', () => {
    it('DOM-порядок названий категорий совпадает с порядком rows', () => {
        const rows = [makeRow('plan-z', 'cat-z'), makeRow('plan-a', 'cat-a'), makeRow('plan-m', 'cat-m')]
        render(<SalesPlanCardList rows={rows} direction="service" selectedIds={new Set()} onToggleRow={vi.fn()} />)

        const categoryNames = screen.getAllByText(/^cat-/).map((node) => node.textContent)
        expect(categoryNames).toEqual(['cat-z', 'cat-a', 'cat-m'])
    })
})
