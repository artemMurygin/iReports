import type { ReactNode } from 'react'
import type { ListProductCategoriesResponse, ListWarehousesResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw.ts'
import { PeriodPicker } from '@/shared/ui-kit/organisms/PeriodPicker.tsx'

import { CategoryTreeSelect } from './CategoryTreeSelect/index.ts'
import { PeriodStatusBadge } from './PeriodStatusBadge.tsx'
import { WarehouseSelect } from './WarehouseSelect.tsx'

export type GoodsTurnoverFilterRowProps = {
    /** Переключатель направления «Сервис/Магазин» (`Tabs`, `GoodsTurnoverReportPage.tsx`) —
     * рендерится этим рядом, а не отдельным блоком над ним, чтобы жить с фильтрами на одном
     * уровне в одном контейнере. */
    tabs: ReactNode
    warehouses: ListWarehousesResponse
    warehouseId: number | null
    onWarehouseChange: (warehouseId: number) => void
    categories: ListProductCategoriesResponse
    categoryId: number | null
    onCategoryChange: (categoryId: number | null) => void
    period: string
    onPeriodChange: (period: string) => void
    maxPeriod: string
    isClosed: boolean
    className?: string
}

/**
 * Filter Row страницы `/goods-turnover-report` (openspec/changes/service-turnover-report, задача
 * 19.1/19.4/20 — собирает воедино `WarehouseSelect`/`CategoryTreeSelect` (задачи 16-17),
 * `PeriodPicker` и `PeriodStatusBadge` в один презентационный ряд, без собственного стейта/
 * условного рендера — только композиция и layout).
 *
 * Pencil (`Get`, узел `eAiFn` в `WvSO6`/десктоп): `Left` (склад + категория) — spacer — `Right`
 * (период + бейдж статуса), одна строка. На мобайле (`yDBTb` → `WIzBc`) те же четыре элемента
 * перегруппированы в два ряда: `Row A` = период (растягивается) + бейдж статуса, `Row B` = чипы
 * склада/категории — Tailwind `order` меняет визуальный порядок групп между брейкпоинтами без
 * дублирования разметки: на мобайле группа период+бейдж идёт первой (order-1), склад+категория —
 * второй (order-2); на `md:` и выше порядок обратный (`md:order-1`/`md:order-3`) и между группами
 * появляется spacer, раздвигающий их по краям строки (задача 20, адаптивность 390).
 *
 * `tabs` (переключатель «Сервис/Магазин») рендерится первым элементом этого же ряда (без своего
 * `order`, поэтому остаётся впереди обеих групп фильтров на любой ширине) — по запросу
 * пользователя вкладки направления должны жить в одном контейнере с фильтрами на одном уровне, а
 * не отдельным блоком над ними (`GoodsTurnoverReportPage.tsx` больше не рендерит `Tabs` сам).
 */
export function GoodsTurnoverFilterRow({
    tabs,
    warehouses,
    warehouseId,
    onWarehouseChange,
    categories,
    categoryId,
    onCategoryChange,
    period,
    onPeriodChange,
    maxPeriod,
    isClosed,
    className,
}: GoodsTurnoverFilterRowProps) {
    return (
        <div
            data-slot="goods-turnover-filter-row"
            className={cn('flex flex-col gap-2 md:flex-row md:items-center md:gap-4', className)}
        >
            <div className="shrink-0 md:border-r md:border-hairline md:pr-4">{tabs}</div>

            <div className="order-2 flex w-full items-center gap-2 md:order-1 md:w-auto md:gap-3">
                <WarehouseSelect warehouses={warehouses} selectedWarehouseId={warehouseId} onSelect={onWarehouseChange} />
                <CategoryTreeSelect categories={categories} selectedId={categoryId} onChange={onCategoryChange} />
            </div>

            <div className="hidden md:block md:flex-1" aria-hidden />

            <div className="order-1 flex w-full items-center gap-2 md:order-3 md:w-auto md:gap-3">
                <PeriodPicker period={period} onChange={onPeriodChange} maxPeriod={maxPeriod} />
                <PeriodStatusBadge isClosed={isClosed} />
            </div>
        </div>
    )
}
