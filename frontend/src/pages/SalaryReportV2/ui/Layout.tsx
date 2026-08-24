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
 * (`isInitialLoad`/`isRefreshing`/`dataVersion`) паттерн, что и
 * `pages/SalaryReport/ui/Layout.tsx`/`pages/SalesPlan/ui/Layout.tsx`/
 * `pages/ServicesReport/ui/Layout.tsx` (`frontend/CLAUDE.md`). Отдельный файл, а не переиспользование
 * `pages/SalaryReport/ui/Layout.tsx` — `pages` не может импортировать другую `pages`
 * (`boundaries/dependencies`), а сам компонент достаточно мал, чтобы дублирование было дешевле
 * обхода границы. Без отдельного слота `error` — см. `pages/SalaryReport/ui/Layout.tsx`'s
 * комментарий, та же причина здесь: `EmployeeReportBodyV2`/`DepartmentReportBodyV2` показывают свою
 * ошибку сами.
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
