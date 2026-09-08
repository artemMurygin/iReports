import { useGoodsTurnoverReportPage } from '@/pages/GoodsTurnoverReport/model/useGoodsTurnoverReportPage.ts'
import { Layout } from '@/pages/GoodsTurnoverReport/ui/Layout.tsx'

// Каркас страницы `/goods-turnover-report` (openspec/changes/service-turnover-report, задача 15) —
// только сборка `useGoodsTurnoverReportPage()` -> `Layout` (по образцу `pages/SalesPlan/ui/
// SalesPlanPage.tsx`, `frontend/CLAUDE.md` "Mediator-компонент для страниц"), без условного
// рендера здесь (правило "медиатор/страница не должен содержать условного рендера" —
// `frontend/CLAUDE.md`). `header`/`body` — заглушки: Filter Row (`WarehouseSelect`/
// `CategoryTreeSelect`/Period Field, задачи 16-17) и `GoodsTurnoverTable` (задача 18) со всеми
// ключевыми состояниями (задача 19) наполняют эти слоты в последующих задачах этого change.
export function GoodsTurnoverReportPage() {
    const page = useGoodsTurnoverReportPage()

    return (
        <Layout
            isInitialLoad={page.isInitialLoad}
            isRefreshing={page.isRefreshing}
            dataVersion={page.dataVersion}
            error={page.error}
        />
    )
}
