import { useCallback, useMemo, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/shared/lib/tw.ts'
import { formatCurrency, formatNumber, formatRatio } from '@/shared/lib/format.ts'

import {
    buildShopGoodsTurnoverTreeRows,
    filterVisibleShopRows,
    getShopRatioColorClass,
    getShopRootDotColor,
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
// `service`) — те же токены Ledger Table (не входят в `shared/ui-kit/tokens/theme.css`, page-local
// деталь конкретно этой таблицы), см. комментарий оригинала.
const ROW_DIVIDER = 'border-[#A9AFAA]'
const ROW_DIVIDER_X = 'divide-[#A9AFAA]'
const TOP_LEVEL_ROW_FILL = 'bg-[#ECF1EE]'
const RAIL_BORDER = 'border-[#DFE3E0]'

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
                'overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_2px_14px_-8px_rgba(1,3,6,0.35)]',
                className,
            )}
        >
            <SummaryRow summary={summary} />
            <HeaderRow />
            {visibleRows.length === 0 ? (
                <div className="px-5 py-6 text-center font-ui text-sm text-ink-muted">Нет строк для выбранных фильтров</div>
            ) : (
                visibleRows.map((row) => (
                    <TableRow key={row.categoryId} row={row} isCollapsed={isCollapsed(row.categoryId)} onToggle={toggle} />
                ))
            )}
            <Footer rootCategoriesCount={summary.rootCategoriesCount} />
        </div>
    )
}

type SummaryRowProps = { summary: ReturnType<typeof summarizeShopGoodsTurnoverRows> }

function SummaryRow({ summary }: SummaryRowProps) {
    return (
        <div className={cn('grid grid-cols-3 divide-x', ROW_DIVIDER_X, 'border-b', ROW_DIVIDER)}>
            <SummaryMetric label="Расход товаров · факт" value={formatCurrency(summary.turnoverSum)} />
            <SummaryMetric
                label="Остаток на складе"
                value={formatCurrency(summary.stockSum)}
                suffix={`${formatNumber(summary.stockQuantity)} шт`}
            />
            <SummaryMetric
                label="Оборачиваемость"
                value={summary.coefficient === null ? '—' : formatRatio(summary.coefficient)}
            />
        </div>
    )
}

type SummaryMetricProps = { label: string; value: string; suffix?: string }

function SummaryMetric({ label, value, suffix }: SummaryMetricProps) {
    return (
        <div className="flex flex-col gap-1.5 px-5 py-4">
            <span className="font-ui text-[11px] font-semibold tracking-[0.4px] text-ink-muted">{label}</span>
            <span className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold tracking-[-0.6px] text-ink tabular-nums">{value}</span>
                {suffix && <span className="font-ui text-xs text-ink-faint">{suffix}</span>}
            </span>
        </div>
    )
}

function HeaderRow() {
    return (
        <div className={cn('flex h-8 items-center bg-canvas border-b', ROW_DIVIDER)}>
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
    return <span className="font-ui text-[11px] font-semibold tracking-[0.3px] text-ink-muted">{children}</span>
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
                ROW_DIVIDER,
                isTopLevel ? 'h-8' : 'h-7',
                isTopLevel ? TOP_LEVEL_ROW_FILL : 'bg-surface',
                row.hasChildren && 'cursor-pointer select-none',
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-1.5 py-0 pr-3 pl-3.5">
                {Array.from({ length: row.depth }).map((_, i) => (
                    <span key={i} className={cn('h-full w-4 shrink-0 border-l', RAIL_BORDER)} aria-hidden />
                ))}
                <Marker hasChildren={row.hasChildren} isTopLevel={isTopLevel} isCollapsed={isCollapsed} />
                {isTopLevel && (
                    <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getShopRootDotColor(row.rootIndex) }}
                        aria-hidden
                    />
                )}
                <span
                    className={cn(
                        'truncate font-ui text-ink',
                        isTopLevel ? 'text-[13px] font-semibold' : row.depth === 1 ? 'text-xs font-medium' : 'text-xs',
                    )}
                >
                    {row.categoryName}
                </span>
            </div>

            <NumCell width={70}>
                <span className="font-mono text-xs font-medium tracking-[-0.2px] text-ink-muted tabular-nums">
                    {formatNumber(row.turnoverQuantity)}
                </span>
            </NumCell>
            <NumCell width={106}>
                <span
                    className={cn(
                        'font-mono tracking-[-0.2px] text-ink tabular-nums',
                        isTopLevel ? 'text-[13px] font-bold' : 'text-xs font-semibold',
                    )}
                >
                    {formatNumber(row.turnoverSum)}
                </span>
            </NumCell>
            <NumCell width={70}>
                <span className="font-mono text-xs font-medium tracking-[-0.2px] text-ink-muted tabular-nums">
                    {formatNumber(row.stockQuantity)}
                </span>
            </NumCell>
            <NumCell width={106}>
                <span
                    className={cn(
                        'font-mono tracking-[-0.2px] text-ink tabular-nums',
                        isTopLevel ? 'text-[13px] font-bold' : 'text-xs font-semibold',
                    )}
                >
                    {formatNumber(row.stockSum)}
                </span>
            </NumCell>
            <NumCell width={84}>
                <span
                    className={cn(
                        'font-mono font-bold tracking-[-0.2px] tabular-nums',
                        isTopLevel ? 'text-[13px]' : 'text-xs',
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
                    className={cn(
                        'size-3.5 transition-transform',
                        isTopLevel ? 'text-ink' : 'text-ink-muted',
                        isCollapsed && '-rotate-90',
                    )}
                />
            ) : (
                <span className="h-px w-1.5 bg-ink-faint" />
            )}
        </span>
    )
}

function Footer({ rootCategoriesCount }: { rootCategoriesCount: number }) {
    return (
        <div className="flex h-10 items-center justify-between gap-4 bg-canvas px-5">
            <span className="font-ui text-xs text-ink-muted">
                {rootCategoriesCount} {pluralizeShopCategories(rootCategoriesCount)}
            </span>
        </div>
    )
}
