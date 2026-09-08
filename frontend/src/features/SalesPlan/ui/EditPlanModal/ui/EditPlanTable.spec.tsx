import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SalesPlanResponse } from 'ireports-contracts'

import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'
import type { EditRowView } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'

import { EditPlanTable } from './EditPlanTable.tsx'

function makeRowView(id: string, category: string): EditRowView {
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
    const row: SalesPlanRow = {
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
    return {
        row,
        values: { turnover: String(plan.turnover), margin: String(plan.margin), orderTypeIds: [] },
        draftTurnover: plan.turnover,
        draftMargin: plan.margin,
        draftOrderTypeIds: [],
        isDirty: false,
    }
}

const EMPTY_SUMMARY = {
    categoriesCount: 0,
    editedCount: 0,
    draftTurnover: 0,
    draftMargin: 0,
    originalTurnover: 0,
    originalMargin: 0,
    factTurnover: 0,
}

function renderTable(canReorder: boolean, rowViews = [makeRowView('plan-a', 'cat-a'), makeRowView('plan-b', 'cat-b')]) {
    const onReorder = vi.fn()
    const utils = render(
        <EditPlanTable
            rowViews={rowViews}
            summary={EMPTY_SUMMARY}
            onFieldChange={vi.fn()}
            showOrderTypes={false}
            orderTypes={[]}
            onOrderTypeIdsChange={vi.fn()}
            canReorder={canReorder}
            onReorder={onReorder}
        />,
    )
    return { ...utils, onReorder }
}

/**
 * Full pointer drag-and-drop (dnd-kit's `PointerSensor`, real `getBoundingClientRect`-driven
 * collision detection) isn't practical to simulate in jsdom — the reorder-state logic itself is
 * covered end-to-end at the `useEditPlanForm.onReorder` level (see
 * `../model/useEditPlanForm.spec.tsx`, "reorders rowViews locally on onReorder"). This file only
 * covers `EditPlanTable`'s own wiring: the drag handle (and the `@dnd-kit` providers around the
 * rows) render only when the `canReorder` prop is true — `useEditPlanForm` now passes `true` for
 * both directions (Фаза 4 shipped the `shop` order endpoint), so this prop-level test exercises
 * the `false` branch directly rather than via a particular `direction`.
 */
describe('EditPlanTable — drag handle wiring (Фаза 2, docs/sales-plan-row-drag-and-drop-reorder)', () => {
    it('renders a drag handle per row when canReorder is true', () => {
        renderTable(true)
        expect(screen.getByRole('button', { name: 'Изменить порядок: cat-a' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Изменить порядок: cat-b' })).toBeInTheDocument()
    })

    it('renders no drag handles at all when canReorder is false', () => {
        renderTable(false)
        expect(screen.queryByRole('button', { name: /Изменить порядок/ })).not.toBeInTheDocument()
    })

    it('still renders both rows (by category name) regardless of canReorder', () => {
        renderTable(false)
        expect(screen.getByText('cat-a')).toBeInTheDocument()
        expect(screen.getByText('cat-b')).toBeInTheDocument()
    })
})
