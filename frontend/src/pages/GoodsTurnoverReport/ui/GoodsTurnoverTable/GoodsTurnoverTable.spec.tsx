import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GoodsTurnoverRow } from '../../model/goodsTurnoverTree.ts'
import { GoodsTurnoverTable } from './GoodsTurnoverTable.tsx'

// Задача 18.4-18.5 (openspec/changes/service-turnover-report): рендер таблицы поверх дерева,
// построенного `buildGoodsTurnoverTreeRows` (уже покрыто TDD в `model/goodsTurnoverTree.spec.ts`)
// — здесь проверяем, что компонент действительно показывает вложенные строки, «—» для
// нерасчитанного коэффициента и агрегат «Итого», а не падает/теряет строки при рендере. Плюс
// сворачивание/разворачивание категорий по клику (добавлено по запросу пользователя после ревью
// готовой фичи — Marker-шеврон изначально был чисто декоративным, см. `ui-design.md`).

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
    it('renders every category row, including nested ones (once expanded), and the empty-ratio placeholder', async () => {
        const user = userEvent.setup()
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
        expect(screen.getByText('Корпусные детали')).toBeInTheDocument()
        expect(screen.getAllByText('—')).not.toHaveLength(0)

        // Все строки сворачиваются по умолчанию — вложенный `iPhone` появляется только после клика.
        expect(screen.queryByText('iPhone')).not.toBeInTheDocument()
        await user.click(screen.getByText('Дисплеи'))
        expect(screen.getByText('iPhone')).toBeInTheDocument()
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

    it('sorts sibling categories alphabetically by default', () => {
        render(
            <GoodsTurnoverTable
                rows={[
                    row({ categoryId: 1, categoryParentId: null, categoryName: 'Экраны' }),
                    row({ categoryId: 2, categoryParentId: null, categoryName: 'Аккумуляторы' }),
                ]}
            />,
        )

        const names = screen.getAllByText(/Экраны|Аккумуляторы/).map((el) => el.textContent)
        expect(names).toEqual(['Аккумуляторы', 'Экраны'])
    })

    it('starts collapsed by default; clicking a category with children expands it, a second click collapses it back', async () => {
        const user = userEvent.setup()
        render(
            <GoodsTurnoverTable
                rows={[
                    row({ categoryId: 1, categoryParentId: null, categoryName: 'Дисплеи' }),
                    row({ categoryId: 2, categoryParentId: 1, categoryName: 'iPhone' }),
                ]}
            />,
        )

        expect(screen.queryByText('iPhone')).not.toBeInTheDocument()

        await user.click(screen.getByText('Дисплеи'))
        expect(screen.getByText('iPhone')).toBeInTheDocument()

        await user.click(screen.getByText('Дисплеи'))
        expect(screen.queryByText('iPhone')).not.toBeInTheDocument()
    })

    it('does not show a colored top-level dot for an orphan whose real parent has no report line (categories directory given)', () => {
        // Справочник: 1 (корень) -> 2 -> 3, но строка отчёта есть только у 3 — родители 1 и 2 не
        // вернули данных за период. Без справочника категория 3 ошибочно выглядела бы отдельным
        // корнем (см. `model/goodsTurnoverTree.spec.ts`, "buildGoodsTurnoverTreeRows with a full
        // category directory").
        render(
            <GoodsTurnoverTable
                rows={[row({ categoryId: 3, categoryParentId: 2, categoryName: 'iPhone 14' })]}
                categories={[
                    { id: 1, parentId: null },
                    { id: 2, parentId: 1 },
                    { id: 3, parentId: 2 },
                ]}
            />,
        )

        const rowEl = screen.getByText('iPhone 14').closest('[data-slot="goods-turnover-row"]')
        // Верхнеуровневая строка красится в жирный/цветную точку через `TOP_LEVEL_ROW_FILL`
        // (`bg-[#ECF1EE]`) — здесь её быть не должно, строка не настоящий корень.
        expect(rowEl?.className).not.toContain('ECF1EE')
    })

    it('does not treat a leaf category (no children) as clickable/collapsible', () => {
        render(<GoodsTurnoverTable rows={[row({ categoryId: 1, categoryParentId: null, categoryName: 'Дисплеи' })]} />)

        const rowEl = screen.getByText('Дисплеи').closest('[data-slot="goods-turnover-row"]')
        expect(rowEl).not.toHaveAttribute('role', 'button')
    })
})
