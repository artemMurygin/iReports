import { type ReactNode } from 'react'

import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

type Props = {
    isInitialLoad?: boolean
    isRefreshing?: boolean
    dataVersion?: number
    header?: ReactNode
    body?: ReactNode
}

/**
 * Слотовый контейнер страницы `/salaries` — тот же `header`/`body` + `RefreshTransitionLayout`
 * (`isInitialLoad`/`isRefreshing`/`dataVersion`), что и `pages/SalesPlan/ui/Layout.tsx`/
 * `pages/ServicesReport/ui/Layout.tsx` (`frontend/CLAUDE.md`). Без отдельного слота `error` —
 * в отличие от `SalesPlan`'s `Layout` (одна плоская таблица, один общий баннер ошибки), у этой
 * страницы два независимых сценария ошибки (сотрудник/отдел) с разным пустым состоянием вокруг
 * неё, поэтому оба `EmployeeReportBody`/`DepartmentReportBody` показывают свою ошибку сами (см.
 * их `errorMessage`-проп) вместо общего баннера здесь.
 */
export function Layout({ isInitialLoad, isRefreshing = false, dataVersion = 0, header, body }: Props) {
    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-4 py-5 md:px-7 md:py-6">
            {header}
            <RefreshTransitionLayout isInitialLoad={isInitialLoad} isRefreshing={isRefreshing} dataVersion={dataVersion}>
                {body}
            </RefreshTransitionLayout>
        </main>
    )
}
