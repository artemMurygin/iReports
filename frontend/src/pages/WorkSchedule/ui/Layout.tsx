import { type ReactNode } from 'react'
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx'
import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

type Props = {
    isInitialLoad?: boolean
    isRefreshing?: boolean
    dataVersion?: number
    header?: ReactNode
    error?: string | null
    body?: ReactNode
}

/** Тот же набор слотов `header`/`error`/`body`, что и `pages/SalesPlan/ui/Layout` — см. её
 * комментарий про происхождение этого соглашения. */
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
