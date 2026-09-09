import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

import { useShopGoodsTurnoverReportPage } from '../model/shop/useShopGoodsTurnoverReportPage.ts'
import { ShopGoodsTurnoverFilterRow } from './shop/FilterRow.tsx'
import { ShopGoodsTurnoverReportBody } from './shop/GoodsTurnoverReportBody.tsx'

/**
 * Содержимое вкладки «Магазин» страницы `/goods-turnover-report` — портировано из `Goods
 * TurnoverReportPage.tsx`/`Layout.tsx` (направление `service`), но без общего `PageHeader`
 * (заголовок страницы и переключатель вкладок теперь одни на обе вкладки, см.
 * `GoodsTurnoverReportPage.tsx`) — сама вкладка отвечает только за свой Filter Row +
 * `RefreshTransitionLayout` + тело отчёта, `<main>`-обёртку страницы предоставляет медиатор.
 * Композиция `useShopGoodsTurnoverReportPage()` -> Filter Row + Body — тот же mediator-паттерн
 * без условного рендера («frontend/CLAUDE.md»), ветвление состояний целиком внутри
 * `ShopGoodsTurnoverReportBody`.
 */
export function ShopGoodsTurnoverReport() {
    const page = useShopGoodsTurnoverReportPage()

    const filterRow = (
        <ShopGoodsTurnoverFilterRow
            warehouses={page.warehouses}
            warehouseId={page.warehouseId}
            onWarehouseChange={page.setWarehouseId}
            categories={page.categories}
            categoryId={page.categoryId}
            onCategoryChange={page.setCategoryId}
            period={page.period}
            onPeriodChange={page.setPeriod}
            maxPeriod={page.maxPeriod}
            isClosed={page.isClosed}
        />
    )

    const body = (
        <ShopGoodsTurnoverReportBody
            error={page.error}
            onRetry={page.retry}
            lines={page.lines}
            rows={page.rows}
            categories={page.categories}
        />
    )

    return (
        <div className="flex flex-col gap-4">
            {filterRow}
            <RefreshTransitionLayout isInitialLoad={page.isInitialLoad} isRefreshing={page.isRefreshing} dataVersion={page.dataVersion}>
                {body}
            </RefreshTransitionLayout>
        </div>
    )
}
