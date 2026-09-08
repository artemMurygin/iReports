import { useGoodsTurnoverReportPage } from '@/pages/GoodsTurnoverReport/model/useGoodsTurnoverReportPage.ts'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader.tsx'

import { GoodsTurnoverFilterRow } from './FilterRow.tsx'
import { GoodsTurnoverReportBody } from './GoodsTurnoverReportBody.tsx'
import { Layout } from './Layout.tsx'

/**
 * Страница `/goods-turnover-report` (openspec/changes/service-turnover-report, задачи 15/19) —
 * сборка `useGoodsTurnoverReportPage()` -> `Layout` (по образцу `pages/SalesPlan/ui/
 * SalesPlanPage.tsx`, `frontend/CLAUDE.md` "Mediator-компонент для страниц"), без условного
 * рендера здесь (правило "медиатор/страница не должен содержать условного рендера" —
 * `frontend/CLAUDE.md`): `header`/`body` — переменные, собранные из уже готовых пропсов хука,
 * ветвление состояний (ошибка/«ещё не пересчитан»/таблица) целиком внутри `GoodsTurnoverReportBody`
 * (задача 19.1-19.3).
 *
 * `PageHeader` — общий organism `shared/ui-kit/` (Pencil: `e84ap`, уже переиспользуется
 * `pages/SalaryRuleList`/`pages/SalesPlan`), а не page-local заголовок — заголовок/подзаголовок
 * этой страницы (Pencil, узлы `xKv4h`/`UhRtf` в `WvSO6`/`yDBTb`) не содержат ничего специфичного
 * (`title`/`subtitle`-only, без `actions`), под этот случай `PageHeader` и предназначен.
 */
export function GoodsTurnoverReportPage() {
    const page = useGoodsTurnoverReportPage()

    const header = (
        <>
            <PageHeader
                title="Оборачиваемость товаров"
                subtitle="Расход и остаток запчастей по категориям справочника и складам за месяц"
            />
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
        </>
    )

    const body = (
        <GoodsTurnoverReportBody error={page.error} onRetry={page.retry} lines={page.report?.lines} rows={page.rows} />
    )

    return (
        <Layout
            isInitialLoad={page.isInitialLoad}
            isRefreshing={page.isRefreshing}
            dataVersion={page.dataVersion}
            header={header}
            body={body}
        />
    )
}
