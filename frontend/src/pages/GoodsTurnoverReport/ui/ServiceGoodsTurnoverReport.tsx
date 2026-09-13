import type { ReactNode } from 'react'

import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

import { useGoodsTurnoverReportPage } from '../model/useGoodsTurnoverReportPage.ts'
import { GoodsTurnoverFilterRow } from './FilterRow.tsx'
import { GoodsTurnoverReportBody } from './GoodsTurnoverReportBody.tsx'

export type ServiceGoodsTurnoverReportProps = {
    /** Переключатель «Сервис/Магазин» — владеет им `GoodsTurnoverReportPage.tsx`, эта вкладка
     * только встраивает его в свой Filter Row (см. комментарий `tabs` в `FilterRow.tsx`). */
    tabs: ReactNode
}

/**
 * Содержимое вкладки «Сервис» страницы `/goods-turnover-report» — выделено из прежнего тела
 * `GoodsTurnoverReportPage.tsx`/`Layout.tsx` при добавлении вкладки «Магазин» (merge
 * feat/shopTurnOverReport): общий `PageHeader` теперь один на обе вкладки
 * (`GoodsTurnoverReportPage.tsx`), эта вкладка отвечает только за свой Filter Row +
 * `RefreshTransitionLayout` + тело отчёта.
 */
export function ServiceGoodsTurnoverReport({ tabs }: ServiceGoodsTurnoverReportProps) {
    const page = useGoodsTurnoverReportPage()

    const filterRow = (
        <GoodsTurnoverFilterRow
            tabs={tabs}
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
            total={page.total}
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
