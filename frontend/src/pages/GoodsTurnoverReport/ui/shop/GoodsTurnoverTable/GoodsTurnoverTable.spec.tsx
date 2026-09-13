import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ShopGoodsTurnoverWarehouseTotal } from 'ireports-contracts'

import type { ShopGoodsTurnoverRow } from '../../../model/shop/goodsTurnoverTree.ts'
import { ShopGoodsTurnoverTable } from './GoodsTurnoverTable.tsx'

// Портировано из `../../GoodsTurnoverTable/GoodsTurnoverTable.spec.tsx` (направление `service`) —
// FR5 of add-department-head-salary-rules: строка «Итого» рендерится из готового `total` ответа
// API (`{lines, totals}` — BREAKING форма ответа shop-отчёта), а не пересчитывается локально
// (`summarizeShopGoodsTurnoverRows`, удалена этим change).

function row(overrides: Partial<ShopGoodsTurnoverRow> & Pick<ShopGoodsTurnoverRow, 'categoryId' | 'categoryParentId'>): ShopGoodsTurnoverRow {
    return {
        categoryName: `Категория ${overrides.categoryId}`,
        warehouseId: 'w1',
        warehouseName: 'Склад',
        turnoverQuantity: 0,
        turnoverSum: 0,
        stockQuantity: 0,
        stockSum: 0,
        coefficient: null,
        ...overrides,
    }
}

describe('ShopGoodsTurnoverTable', () => {
    it('renders the "Итого" row straight from the total prop, not recomputed from rows', () => {
        const total: ShopGoodsTurnoverWarehouseTotal = {
            warehouseId: 'w1',
            turnoverSum: 100_000,
            stockSum: 50_000,
            stockQuantity: 10,
            coefficient: 1.5,
        }
        render(
            <ShopGoodsTurnoverTable
                rows={[row({ categoryId: 'c1', categoryParentId: null, turnoverSum: 999, stockSum: 999, stockQuantity: 999 })]}
                total={total}
            />,
        )

        expect(screen.getByText('100 000 ₽')).toBeInTheDocument()
        expect(screen.getByText('50 000 ₽')).toBeInTheDocument()
        expect(screen.getByText('1,50')).toBeInTheDocument()
        expect(screen.queryByText('999 ₽')).not.toBeInTheDocument()
    })

    it('renders a dash placeholder in the summary row when no total is given for the current warehouse', () => {
        render(<ShopGoodsTurnoverTable rows={[row({ categoryId: 'c1', categoryParentId: null })]} total={null} />)

        expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })
})
