import { type ReactNode } from 'react'
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx'
import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

type Props = {
    isInitialLoad?: boolean
    isRefreshing?: boolean
    dataVersion?: number
    header?: ReactNode
    error: string | null
    body?: ReactNode
}

/**
 * Слотовый контейнер страницы `/services` — тот же `header`/`body` + `RefreshTransitionLayout`
 * (`isInitialLoad`/`isRefreshing`/`dataVersion`) паттерн, что и `pages/SalaryReportV2/ui/Layout.tsx`
 * (`frontend/CLAUDE.md`), retint на новые токены (`bg-canvas`, отступы `px-4 py-5 md:px-7 md:py-6`).
 * Отдельный слот `error` (в отличие от SalaryReportV2's Layout) сохранён — `ServicesAnalytics`
 * рендерит `ErrorLayout` здесь же, внутри `RefreshTransitionLayout`, а не в презентационном
 * дочернем компоненте.
 */
export function Layout({ isInitialLoad, isRefreshing = false, dataVersion = 0, header, error, body }: Props) {
    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-4 py-5 md:px-7 md:py-6">
            {header}
            <RefreshTransitionLayout isInitialLoad={isInitialLoad} isRefreshing={isRefreshing} dataVersion={dataVersion}>
                {error && <ErrorLayout error={error} />}
                {body}
            </RefreshTransitionLayout>
        </main>
    )
}
