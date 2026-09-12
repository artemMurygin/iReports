import { useCallback, useMemo, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/shared/lib/tw.ts'
import { formatCurrency, formatNumber, formatRatio } from '@/shared/lib/format.ts'

import {
    buildShopGoodsTurnoverTreeRows,
    filterVisibleShopRows,
    getShopRatioColorClass,
    pluralizeShopCategories,
    summarizeShopGoodsTurnoverRows,
    type ShopGoodsTurnoverRow,
    type ShopGoodsTurnoverTreeRow,
} from '../../../model/shop/goodsTurnoverTree.ts'
import type { ShopCategoryRef } from '../../../model/shop/categoryTree.ts'
import { useExpandedShopCategories } from './model/useExpandedCategories.ts'

export type ShopGoodsTurnoverTableProps = {
    rows: ShopGoodsTurnoverRow[]
    /** Полный (плоский) каталог категорий — источник истины для реальной глубины/родства строк,
     * см. `buildShopGoodsTurnoverTreeRows`. */
    categories?: ShopCategoryRef[]
    className?: string
}

// Портировано без изменений из `../../GoodsTurnoverTable/GoodsTurnoverTable.tsx` (направление
// `service`) — та же принятая ревизия палитры Ledger Table (page-local, кроме шрифтов
// `font-lg-ui`/`font-lg-num` — см. комментарий оригинала и `shared/ui-kit/tokens/theme.css`).
const LG_INK = 'text-[#14161A]'
const LG_INK_BG = 'bg-[#14161A]'
const LG_INK_SOFT = 'text-[#5B626D]'
const LG_INK_MUTED = 'text-[#6E7681]'
const LG_BORDER = 'border-[#DFE2E7]'
const LG_LINE = 'border-[#EDEEF1]'
const LG_LINE_X = 'divide-[#EDEEF1]'
const LG_RAIL = 'border-[#E6E8EC]'
const LG_GROUP = 'bg-[#F6F7F9]'
const LG_CANVAS = 'bg-[#FBFBFC]'
const LG_SURFACE = 'bg-[#FFFFFF]'
const LG_DASH = 'bg-[#C4C9D1]'

const FONT_UI = 'font-lg-ui'
const FONT_NUM = 'font-lg-num'

/**
 * Таблица отчёта по оборачиваемости товаров вкладки «Магазин» — портировано из `../../
 * GoodsTurnoverTable/GoodsTurnoverTable.tsx` (направление `service`, паттерн «Ledger», см.
 * комментарий оригинала за полным описанием) с заменой числового `categoryId` на строковый и
 * полей контракта (`turnoverQuantity`/`turnoverSum`/`coefficient` вместо `outcomeQuantity`/
 * `outcomeSum`/`turnoverRatio`) — визуально и по поведению идентична оригиналу.
 */
export function ShopGoodsTurnoverTable({ rows, categories = [], className }: ShopGoodsTurnoverTableProps) {
    const treeRows = useMemo(() => buildShopGoodsTurnoverTreeRows(rows, categories), [rows, categories])
    const summary = useMemo(() => summarizeShopGoodsTurnoverRows(rows, categories), [rows, categories])
    const { isExpanded, toggle } = useExpandedShopCategories()
    const isCollapsed = useCallback((categoryId: string) => !isExpanded(categoryId), [isExpanded])
    const visibleRows = useMemo(() => filterVisibleShopRows(treeRows, isCollapsed), [treeRows, isCollapsed])

    return (
        <div
            data-slot="shop-goods-turnover-table"
            className={cn(
                'overflow-hidden rounded-[10px] shadow-[0_1px_3px_0_rgba(20,26,36,0.06)]',
                'border',
                LG_BORDER,
                LG_SURFACE,
                className,
            )}
        >
            <SummaryRow summary={summary} />
            <HeaderRow />
            {visibleRows.length === 0 ? (
                <div className={cn('px-5 py-6 text-center text-sm', FONT_UI, LG_INK_MUTED)}>Нет строк для выбранных фильтров</div>
            ) : (
                visibleRows.map((row) => (
                    <TableRow key={row.categoryId} row={row} isCollapsed={isCollapsed(row.categoryId)} onToggle={toggle} />
                ))
            )}
            <Footer summary={summary} />
        </div>
    )
}

type SummaryRowProps = { summary: ReturnType<typeof summarizeShopGoodsTurnoverRows> }

function SummaryRow({ summary }: SummaryRowProps) {
    return (
        <div className={cn('grid grid-cols-3 divide-x', LG_LINE_X, 'border-b', LG_BORDER)}>
            <SummaryMetric label="Расход товаров · факт" value={formatCurrency(summary.turnoverSum)} />
            <SummaryMetric label="Остаток на складе" value={formatCurrency(summary.stockSum)} />
            <SummaryMetric
                label="Оборачиваемость"
                value={summary.coefficient === null ? '—' : formatRatio(summary.coefficient)}
            />
        </div>
    )
}

type SummaryMetricProps = { label: string; value: string }

function SummaryMetric({ label, value }: SummaryMetricProps) {
    return (
        <div className="flex flex-col gap-1.5 px-5 py-[18px]">
            <span className={cn('text-[10px] font-semibold tracking-[0.9px] uppercase', FONT_UI, LG_INK_MUTED)}>{label}</span>
            <span className={cn('text-2xl font-bold tracking-[-0.6px] tabular-nums', FONT_UI, LG_INK)}>{value}</span>
        </div>
    )
}

function HeaderRow() {
    return (
        <div className={cn('flex h-8 items-center border-b', LG_SURFACE, LG_BORDER)}>
            <div className="min-w-0 flex-1 px-3.5 py-0">
                <ColumnLabel>Категория</ColumnLabel>
            </div>
            <NumCell width={70}>
                <ColumnLabel>шт</ColumnLabel>
            </NumCell>
            <NumCell width={106}>
                <ColumnLabel>Расход, ₽</ColumnLabel>
            </NumCell>
            <NumCell width={70}>
                <ColumnLabel>шт</ColumnLabel>
            </NumCell>
            <NumCell width={106}>
                <ColumnLabel>Остаток, ₽</ColumnLabel>
            </NumCell>
            <NumCell width={84}>
                <ColumnLabel>Обор.</ColumnLabel>
            </NumCell>
        </div>
    )
}

function ColumnLabel({ children }: { children: ReactNode }) {
    return <span className={cn('text-[10px] font-semibold tracking-[0.9px] uppercase', FONT_UI, LG_INK_MUTED)}>{children}</span>
}

function NumCell({ width, children }: { width: number; children: ReactNode }) {
    return (
        <div className="flex h-full items-center justify-end px-3" style={{ width }}>
            {children}
        </div>
    )
}

type TableRowProps = { row: ShopGoodsTurnoverTreeRow; isCollapsed: boolean; onToggle: (categoryId: string) => void }

function TableRow({ row, isCollapsed, onToggle }: TableRowProps) {
    const isTopLevel = row.depth === 0
    const isSecondLevel = row.depth === 1
    const ratioText = row.coefficient === null ? '—' : formatRatio(row.coefficient)

    return (
        <div
            data-slot="shop-goods-turnover-row"
            role={row.hasChildren ? 'button' : undefined}
            tabIndex={row.hasChildren ? 0 : undefined}
            aria-expanded={row.hasChildren ? !isCollapsed : undefined}
            onClick={row.hasChildren ? () => onToggle(row.categoryId) : undefined}
            onKeyDown={
                row.hasChildren
                    ? (e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          onToggle(row.categoryId)
                      }
                    : undefined
            }
            className={cn(
                'flex items-center border-b',
                LG_LINE,
                isTopLevel ? 'h-8' : 'h-7',
                isTopLevel ? LG_GROUP : LG_SURFACE,
                row.hasChildren && 'cursor-pointer select-none',
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-1.5 py-0 pr-3 pl-3.5">
                {Array.from({ length: row.depth }).map((_, i) => (
                    <span key={i} className={cn('h-full w-4 shrink-0 border-l', LG_RAIL)} aria-hidden />
                ))}
                <Marker hasChildren={row.hasChildren} isTopLevel={isTopLevel} isCollapsed={isCollapsed} />
                {isTopLevel && <span className={cn('size-[5px] shrink-0 rounded-full', LG_INK_BG)} aria-hidden />}
                <span
                    className={cn(
                        'truncate',
                        FONT_UI,
                        isTopLevel && cn('text-[13px] font-semibold tracking-[-0.1px]', LG_INK),
                        isSecondLevel && cn('text-xs font-medium', LG_INK),
                        !isTopLevel && !isSecondLevel && cn('text-xs', LG_INK_SOFT),
                    )}
                >
                    {row.categoryName}
                </span>
            </div>

            <NumCell width={70}>
                <span className={cn('text-[11px] tracking-[-0.25px] tabular-nums', FONT_NUM, LG_INK_MUTED)}>
                    {formatNumber(row.turnoverQuantity)}
                </span>
            </NumCell>
            <NumCell width={106}>
                <span
                    className={cn(
                        'tracking-[-0.25px] tabular-nums',
                        FONT_NUM,
                        LG_INK,
                        isTopLevel ? 'text-xs font-semibold' : 'text-xs font-medium',
                    )}
                >
                    {formatNumber(row.turnoverSum)}
                </span>
            </NumCell>
            <NumCell width={70}>
                <span className={cn('text-[11px] tracking-[-0.25px] tabular-nums', FONT_NUM, LG_INK_MUTED)}>
                    {formatNumber(row.stockQuantity)}
                </span>
            </NumCell>
            <NumCell width={106}>
                <span
                    className={cn(
                        'tracking-[-0.25px] tabular-nums',
                        FONT_NUM,
                        LG_INK,
                        isTopLevel ? 'text-xs font-semibold' : 'text-xs font-medium',
                    )}
                >
                    {formatNumber(row.stockSum)}
                </span>
            </NumCell>
            <NumCell width={84}>
                <span
                    className={cn(
                        'tracking-[-0.25px] tabular-nums',
                        FONT_NUM,
                        isTopLevel ? 'text-xs font-semibold' : 'text-xs font-medium',
                        getShopRatioColorClass(row.coefficient),
                    )}
                >
                    {ratioText}
                </span>
            </NumCell>
        </div>
    )
}

function Marker({ hasChildren, isTopLevel, isCollapsed }: { hasChildren: boolean; isTopLevel: boolean; isCollapsed: boolean }) {
    return (
        <span className="flex h-full w-5 shrink-0 items-center justify-center" aria-hidden>
            {hasChildren ? (
                <ChevronDown
                    className={cn('size-3 transition-transform', isTopLevel ? LG_INK : LG_INK_MUTED, isCollapsed && '-rotate-90')}
                />
            ) : (
                <span className={cn('h-px w-1.5', LG_DASH)} />
            )}
        </span>
    )
}

function Footer({ summary }: { summary: ReturnType<typeof summarizeShopGoodsTurnoverRows> }) {
    const totalRatioText = summary.coefficient === null ? '—' : formatRatio(summary.coefficient)

    return (
        <div className={cn('flex h-10 items-center justify-between gap-4 px-5', LG_CANVAS)}>
            <span className={cn('text-[11px]', FONT_UI, LG_INK_MUTED)}>
                {summary.rootCategoriesCount} {pluralizeShopCategories(summary.rootCategoriesCount)}
            </span>
            <span className={cn('text-[11px] font-semibold tabular-nums', FONT_NUM, LG_INK)}>
                Итого&nbsp;&nbsp;&nbsp;{formatCurrency(summary.turnoverSum)}&nbsp;&nbsp;·&nbsp;&nbsp;
                {formatCurrency(summary.stockSum)}&nbsp;&nbsp;·&nbsp;&nbsp;{totalRatioText}
            </span>
        </div>
    )
}
