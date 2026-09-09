import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

import { useGoodsTurnoverReportPage } from '../model/useGoodsTurnoverReportPage.ts'
import { GoodsTurnoverFilterRow } from './FilterRow.tsx'
import { GoodsTurnoverReportBody } from './GoodsTurnoverReportBody.tsx'

/**
 * Содержимое вкладки «Сервис» страницы `/goods-turnover-report` — выделено из прежнего тела
 * `GoodsTurnoverReportPage.tsx`/`Layout.tsx` при добавлении вкладки «Магазин» (merge
 * feat/shopTurnOverReport): общий `PageHeader` и переключатель вкладок теперь один на обе вкладки
 * (`GoodsTurnoverReportPage.tsx`), эта вкладка отвечает только за свой Filter Row +
 * `RefreshTransitionLayout` + тело отчёта — поведение и разметка не изменились.
 */
export function ServiceGoodsTurnoverReport() {
    const page = useGoodsTurnoverReportPage()

    const filterRow = (
        <GoodsTurnoverFilterRow
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
        <GoodsTurnoverReportBody
            error={page.error}
            onRetry={page.retry}
            lines={page.report?.lines}
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
