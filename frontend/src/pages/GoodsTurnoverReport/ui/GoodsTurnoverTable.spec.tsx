import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { GoodsTurnoverRow } from '../model/goodsTurnoverTree.ts'
import { GoodsTurnoverTable } from './GoodsTurnoverTable.tsx'

// Задача 18.4-18.5 (openspec/changes/service-turnover-report): рендер таблицы поверх дерева,
// построенного `buildGoodsTurnoverTreeRows` (уже покрыто TDD в `model/goodsTurnoverTree.spec.ts`)
// — здесь проверяем, что компонент действительно показывает вложенные строки, «—» для
// нерасчитанного коэффициента и агрегат «Итого», а не падает/теряет строки при рендере.

function row(overrides: Partial<GoodsTurnoverRow> & Pick<GoodsTurnoverRow, 'categoryId' | 'categoryParentId'>): GoodsTurnoverRow {
    return {
        categoryName: `Категория ${overrides.categoryId}`,
        warehouseId: 1,
        warehouseName: 'Склад',
        outcomeQuantity: 0,
        outcomeSum: 0,
        stockQuantity: 0,
        stockSum: 0,
        turnoverRatio: null,
        ...overrides,
    }
}

describe('GoodsTurnoverTable', () => {
    it('renders every category row, including nested ones, and the empty-ratio placeholder', () => {
        render(
            <GoodsTurnoverTable
                rows={[
                    row({
                        categoryId: 1,
                        categoryParentId: null,
                        categoryName: 'Дисплеи',
                        outcomeSum: 186_400,
                        stockSum: 214_700,
                        turnoverRatio: 0.89,
                    }),
                    row({
                        categoryId: 2,
                        categoryParentId: 1,
                        categoryName: 'iPhone',
                        outcomeSum: 128_300,
                        stockSum: 141_200,
                        turnoverRatio: 0.95,
                    }),
                    row({
                        categoryId: 3,
                        categoryParentId: null,
                        categoryName: 'Корпусные детали',
                        outcomeQuantity: 0,
                        outcomeSum: 0,
                        stockQuantity: 0,
                        stockSum: 0,
                        turnoverRatio: null,
                    }),
                ]}
            />,
        )

        expect(screen.getByText('Дисплеи')).toBeInTheDocument()
        expect(screen.getByText('iPhone')).toBeInTheDocument()
        expect(screen.getByText('Корпусные детали')).toBeInTheDocument()
        expect(screen.getAllByText('—')).not.toHaveLength(0)
    })

    it('sums the summary row over root categories only (no double counting of the rollup)', () => {
        render(
            <GoodsTurnoverTable
                rows={[
                    row({ categoryId: 1, categoryParentId: null, outcomeSum: 100_000, stockSum: 50_000, stockQuantity: 10 }),
                    row({ categoryId: 2, categoryParentId: 1, outcomeSum: 60_000, stockSum: 30_000, stockQuantity: 6 }),
                    row({ categoryId: 3, categoryParentId: 1, outcomeSum: 40_000, stockSum: 20_000, stockQuantity: 4 }),
                ]}
            />,
        )

        expect(screen.getByText('100 000 ₽')).toBeInTheDocument()
        expect(screen.getByText('50 000 ₽')).toBeInTheDocument()
    })

    it('renders a fallback message instead of an empty table body when there are no rows', () => {
        render(<GoodsTurnoverTable rows={[]} />)

        expect(screen.getByText('Нет строк для выбранных фильтров')).toBeInTheDocument()
    })
})
