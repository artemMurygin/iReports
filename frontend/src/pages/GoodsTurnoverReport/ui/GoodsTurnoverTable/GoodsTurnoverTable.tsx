import { useCallback, useMemo, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/shared/lib/tw.ts'
import { formatCurrency, formatNumber, formatRatio } from '@/shared/lib/format.ts'

import {
    buildGoodsTurnoverTreeRows,
    filterVisibleRows,
    getRatioColorClass,
    pluralizeCategories,
    summarizeGoodsTurnoverRows,
    type GoodsTurnoverRow,
    type GoodsTurnoverTreeRow,
    type ProductCategoryRef,
} from '../../model/goodsTurnoverTree.ts'
import { useExpandedCategories } from './model/useExpandedCategories.ts'

export type GoodsTurnoverTableProps = {
    rows: GoodsTurnoverRow[]
    /** Полный справочник категорий (`ListProductCategoriesService`) — источник истины для
     * реальной глубины/родства строк, см. `buildGoodsTurnoverTreeRows`. Опущен => прежнее
     * поведение "родство только по `rows`" (без справочника под рукой — тесты). */
    categories?: ProductCategoryRef[]
    className?: string
}

// Ledger Table — принятая ревизия дизайна (Pencil design/sallary-first-iteration.pen, `WvSO6`
// «Альтернатива A»). Палитра — общие токены UI Kit (`shared/ui-kit/tokens/theme.css`), 1:1 с
// цветами макета (`$ink`/`$ink-muted`/`$hairline`/`$canvas`/`$surface`/`$ink-faint`); отдельной
// page-local палитры для этой таблицы больше нет — только шрифты (`font-lg-ui`/`font-lg-num`)
// остаются особым случаем, см. комментарий в theme.css. Имена констант сохранены для читаемости
// (документируют роль борта/фона), хотя часть из них теперь ссылается на один и тот же токен.
const LG_INK = 'text-ink'
const LG_INK_BG = 'bg-ink'
const LG_INK_SOFT = 'text-ink-muted'
const LG_INK_MUTED = 'text-ink-muted'
// Граница структурных блоков (карточка целиком, низ шапки колонок, низ строки «Итого»).
const LG_BORDER = 'border-hairline'
// Разделитель строк тела таблицы и внутренних мини-метрик «Итого».
const LG_LINE = 'border-hairline'
const LG_LINE_X = 'divide-hairline'
// Rail — вертикальная направляющая отступа вложенности (по одной на уровень предка).
const LG_RAIL = 'border-hairline'
// Заливка строки верхнего уровня (категория 1-го уровня).
const LG_GROUP = 'bg-canvas'
const LG_CANVAS = 'bg-canvas'
const LG_SURFACE = 'bg-surface'
// Маркер-«тире» у строк-листьев (без потомков).
const LG_DASH = 'bg-ink-faint'

const FONT_UI = 'font-lg-ui'
const FONT_NUM = 'font-lg-num'

/**
 * Таблица отчёта по оборачиваемости товаров, паттерн «Ledger» (openspec/changes/
 * service-turnover-report, задача 18; ui-design.md "Доработка таблицы", узел `D3Sf4` в `WvSO6`) —
 * своя строка «Итого» (3 мини-метрики), `Header Row`, затем рекурсивно развёрнутые строки дерева
 * категорий с `Rail`-отступами (по одному `Rail` 16px на уровень предка, без капа глубины) и
 * `Marker` (`Chevron` — у категории есть дочерние, `Dash` — лист), колонки расход/остаток
 * (шт/₽)/коэффициент («—» при `turnoverRatio: null`), футер со счётчиком категорий и повтором
 * агрегата.
 *
 * Категории по умолчанию отсортированы по алфавиту на каждом уровне (`buildGoodsTurnoverTreeRows`)
 * и по умолчанию ВСЕ свёрнуты — разворачиваются кликом по строке; состояние `useExpandedCategories`
 * (локальное, сбрасывается при размонтировании) ключуется по `categoryId`, не по позиции в списке.
 *
 * `rows` — уже отфильтрованные по одному складу строки отчёта (architecture.md: `rows:
 * GoodsTurnoverRow[]` — "для выбранного склада"); фильтрацию по складу/категории делает
 * вызывающая сторона (`useGoodsTurnoverReportPage`/`CategoryTreeSelect`, задачи 15/17), сама
 * таблица только строит дерево из того, что получила. `categories` — полный справочник (не
 * отфильтрованный по складу/периоду), нужен только для корректной глубины/родства строк, чьи
 * настоящие предки не вернули данных за период (см. `buildGoodsTurnoverTreeRows`).
 */
export function GoodsTurnoverTable({ rows, categories = [], className }: GoodsTurnoverTableProps) {
    const treeRows = useMemo(() => buildGoodsTurnoverTreeRows(rows, categories), [rows, categories])
    const summary = useMemo(() => summarizeGoodsTurnoverRows(rows, categories), [rows, categories])
    const { isExpanded, toggle } = useExpandedCategories()
    const isCollapsed = useCallback((categoryId: number) => !isExpanded(categoryId), [isExpanded])
    const visibleRows = useMemo(() => filterVisibleRows(treeRows, isCollapsed), [treeRows, isCollapsed])

    return (
        <div
            data-slot="goods-turnover-table"
            className={cn(
                'overflow-hidden rounded-[10px] shadow-[0_1px_3px_0_rgba(1,3,6,0.06)]',
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

type SummaryRowProps = { summary: ReturnType<typeof summarizeGoodsTurnoverRows> }

function SummaryRow({ summary }: SummaryRowProps) {
    return (
        <div className={cn('grid grid-cols-3 divide-x', LG_LINE_X, 'border-b', LG_BORDER)}>
            <SummaryMetric label="Расход запчастей · факт" value={formatCurrency(summary.outcomeSum)} />
            <SummaryMetric label="Остаток на складе" value={formatCurrency(summary.stockSum)} />
            <SummaryMetric
                label="Оборачиваемость"
                value={summary.turnoverRatio === null ? '—' : formatRatio(summary.turnoverRatio)}
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

type TableRowProps = { row: GoodsTurnoverTreeRow; isCollapsed: boolean; onToggle: (categoryId: number) => void }

function TableRow({ row, isCollapsed, onToggle }: TableRowProps) {
    const isTopLevel = row.depth === 0
    const isSecondLevel = row.depth === 1
    const ratioText = row.turnoverRatio === null ? '—' : formatRatio(row.turnoverRatio)

    return (
        <div
            data-slot="goods-turnover-row"
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
                    {formatNumber(row.outcomeQuantity)}
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
                    {formatNumber(row.outcomeSum)}
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
                        getRatioColorClass(row.turnoverRatio),
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

function Footer({ summary }: { summary: ReturnType<typeof summarizeGoodsTurnoverRows> }) {
    const totalRatioText = summary.turnoverRatio === null ? '—' : formatRatio(summary.turnoverRatio)

    return (
        <div className={cn('flex h-10 items-center justify-between gap-4 px-5', LG_CANVAS)}>
            <span className={cn('text-[11px]', FONT_UI, LG_INK_MUTED)}>
                {summary.rootCategoriesCount} {pluralizeCategories(summary.rootCategoriesCount)}
            </span>
            <span className={cn('text-[11px] font-semibold tabular-nums', FONT_NUM, LG_INK)}>
                Итого&nbsp;&nbsp;&nbsp;{formatCurrency(summary.outcomeSum)}&nbsp;&nbsp;·&nbsp;&nbsp;
                {formatCurrency(summary.stockSum)}&nbsp;&nbsp;·&nbsp;&nbsp;{totalRatioText}
            </span>
        </div>
    )
}
