import { useState } from 'react'
import { Search } from 'lucide-react'
import type { BalanceTransactionType } from 'ireports-contracts'

import { transactionTypeLabel } from '@/features/EmployeeBalance'
import { cn } from '@/shared/lib/tw'
import { Input } from '@/shared/ui-kit/atoms/Input'

import { splitVisibleChips } from '../model/chipVisibility.ts'

const ALL_TYPES = Object.keys(transactionTypeLabel) as BalanceTransactionType[]

/** Число чипов типа, видимых сразу на мобильной раскладке до кнопки «Ещё N» (Pencil `JTc29`) —
 * десктоп всегда показывает все десять чипов, перенося строкой (`flex-wrap`). */
const MOBILE_VISIBLE_TYPES_COUNT = 5

export type BalanceFiltersProps = {
    selectedTypes: readonly BalanceTransactionType[]
    onToggleType: (type: BalanceTransactionType) => void
    onClearTypes: () => void
    search: string
    onSearchChange: (search: string) => void
    className?: string
}

function TypeChip({
    active,
    label,
    onClick,
}: {
    active: boolean
    label: string
    onClick: () => void
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'shrink-0 rounded-full border px-3.5 py-[7px] font-ui text-[13px] font-medium whitespace-nowrap transition-colors select-none',
                active ? 'border-ink bg-ink text-surface' : 'border-hairline bg-surface text-ink hover:bg-canvas',
            )}
        >
            {label}
        </button>
    )
}

/**
 * Фильтры ленты (Pencil `L73YCK`/`JTc29`, docs/employee-settlements-page-redesign, Фаза 5) —
 * чипы типов движения («Все типы» + все 10, мультиселект-toggle, та же геометрия, что
 * `AccrualStatusFilterRow`, только без взаимоисключения) + поиск по комментарию. Замена
 * прежнего мультиселекта из Фазы 10 docs/payroll-closing-and-accrual (та же логика выбора
 * типов, новый только визуал + поиск). Период переехал в `BalanceActions` — эта строка теперь
 * только про то, КАКИЕ движения показывать, а не за КАКОЙ месяц.
 *
 * Десктоп (`hidden md:flex`) переносит все 10 чипов строкой без сворачивания. Мобильная
 * раскладка (`flex md:hidden`) показывает первые `MOBILE_VISIBLE_TYPES_COUNT` чипов и кнопку
 * «Ещё N» (`splitVisibleChips`), разворачивающую остаток по клику — сама раскладка рендерится
 * дважды (тот же приём, что `TransactionsLedger`/`TransactionsCardList`), брейкпоинт решает,
 * какая видна.
 */
export function BalanceFilters({
    selectedTypes,
    onToggleType,
    onClearTypes,
    search,
    onSearchChange,
    className,
}: BalanceFiltersProps) {
    const [mobileExpanded, setMobileExpanded] = useState(false)
    const { visible: mobileVisibleTypes, hidden: mobileHiddenTypes } = splitVisibleChips(
        ALL_TYPES,
        MOBILE_VISIBLE_TYPES_COUNT,
    )

    const searchInput = (
        <div className="relative min-w-[220px] flex-1 md:max-w-[280px] md:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-ink-faint" />
            <Input
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Поиск по комментарию"
                aria-label="Поиск по комментарию"
                className="pl-9"
            />
        </div>
    )

    return (
        <div data-slot="employee-balance-filters" className={cn('flex flex-col gap-2.5', className)}>
            {/* Десктоп: все чипы одной переносящейся строкой, поиск справа. */}
            <div
                data-slot="employee-balance-filters-desktop"
                className="hidden items-center justify-between gap-4 md:flex"
            >
                <div className="flex flex-wrap items-center gap-2">
                    <TypeChip active={selectedTypes.length === 0} label="Все типы" onClick={onClearTypes} />
                    {ALL_TYPES.map((type) => (
                        <TypeChip
                            key={type}
                            active={selectedTypes.includes(type)}
                            label={transactionTypeLabel[type]}
                            onClick={() => onToggleType(type)}
                        />
                    ))}
                </div>
                {searchInput}
            </div>

            {/* Мобайл: поиск над чипами, чипы сворачиваются за «Ещё N» (Pencil `JTc29`). */}
            <div data-slot="employee-balance-filters-mobile" className="flex flex-col gap-2.5 md:hidden">
                {searchInput}
                <div className="-mx-4 flex flex-wrap items-center gap-2 px-4">
                    <TypeChip active={selectedTypes.length === 0} label="Все типы" onClick={onClearTypes} />
                    {mobileVisibleTypes.map((type) => (
                        <TypeChip
                            key={type}
                            active={selectedTypes.includes(type)}
                            label={transactionTypeLabel[type]}
                            onClick={() => onToggleType(type)}
                        />
                    ))}
                    {!mobileExpanded && mobileHiddenTypes.length > 0 && (
                        <TypeChip
                            active={false}
                            label={`Ещё ${mobileHiddenTypes.length}`}
                            onClick={() => setMobileExpanded(true)}
                        />
                    )}
                    {mobileExpanded &&
                        mobileHiddenTypes.map((type) => (
                            <TypeChip
                                key={type}
                                active={selectedTypes.includes(type)}
                                label={transactionTypeLabel[type]}
                                onClick={() => onToggleType(type)}
                            />
                        ))}
                </div>
            </div>
        </div>
    )
}
