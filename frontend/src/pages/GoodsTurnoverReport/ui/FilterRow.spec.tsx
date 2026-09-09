import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ListProductCategoriesResponse, ListWarehousesResponse } from 'ireports-contracts'

import { GoodsTurnoverFilterRow } from './FilterRow.tsx'

const WAREHOUSES: ListWarehousesResponse = [{ id: 1, name: 'Тверская' }]
const CATEGORIES: ListProductCategoriesResponse = [{ id: 10, name: 'Дисплеи', parentId: null }]

function renderRow(overrides: Partial<React.ComponentProps<typeof GoodsTurnoverFilterRow>> = {}) {
    return render(
        <GoodsTurnoverFilterRow
            warehouses={WAREHOUSES}
            warehouseId={1}
            onWarehouseChange={vi.fn()}
            categories={CATEGORIES}
            categoryId={null}
            onCategoryChange={vi.fn()}
            period="2026-08"
            onPeriodChange={vi.fn()}
            maxPeriod="2026-08"
            isClosed={false}
            {...overrides}
        />,
    )
}

// Задача 19.1/19.4 (openspec/changes/service-turnover-report): Filter Row собирает
// WarehouseSelect/CategoryTreeSelect/PeriodPicker/PeriodStatusBadge вместе — сама композиция без
// собственной бизнес-логики, здесь только smoke-проверка, что все четыре виджета действительно
// рендерятся и открытый/закрытый статус переключает бейдж.
describe('GoodsTurnoverFilterRow', () => {
    it('renders the warehouse value, period value and "all categories" placeholder together', () => {
        renderRow()
        expect(screen.getAllByText('Тверская').length).toBeGreaterThan(0)
        expect(screen.getAllByText('август 2026').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Все категории').length).toBeGreaterThan(0)
    })

    it('shows the open-period badge by default and the closed-period badge when isClosed=true', () => {
        const { rerender } = renderRow({ isClosed: false })
        expect(screen.getAllByText(/Открыт/).length).toBeGreaterThan(0)

        rerender(
            <GoodsTurnoverFilterRow
                warehouses={WAREHOUSES}
                warehouseId={1}
                onWarehouseChange={vi.fn()}
                categories={CATEGORIES}
                categoryId={null}
                onCategoryChange={vi.fn()}
                period="2026-08"
                onPeriodChange={vi.fn()}
                maxPeriod="2026-08"
                isClosed={true}
            />,
        )
        expect(screen.getAllByText(/Закрыт/).length).toBeGreaterThan(0)
    })
})
