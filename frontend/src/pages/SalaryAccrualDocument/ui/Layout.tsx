import { type ReactNode } from 'react'
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx'
import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

type Props = {
    isInitialLoad?: boolean
    isRefreshing?: boolean
    dataVersion?: number
    error?: string | null
    body?: ReactNode
}

/**
 * Same slot shape as `pages/SalesPlan/ui/Layout`, without a separate `header` slot: this
 * page's header (breadcrumb + employee card) is itself built from the fetched document,
 * so it lives inside `body` behind the same `RefreshTransitionLayout` gate.
 */
export function Layout({ isInitialLoad, isRefreshing = false, dataVersion = 0, error, body }: Props) {
    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-4 py-5 md:px-7 md:py-6">
            <RefreshTransitionLayout isInitialLoad={isInitialLoad} isRefreshing={isRefreshing} dataVersion={dataVersion}>
                {error && <ErrorLayout error={error} />}
                {body}
            </RefreshTransitionLayout>
        </main>
    )
}
