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

/**
 * Same `header`/`error`/`body` slot shape as `pages/ServicesReport/ui/Layout` and
 * `pages/FunnelReport/ui/Layout` — see those for the convention this mirrors.
 */
export function Layout({ isInitialLoad, isRefreshing = false, dataVersion = 0, header, error, body }: Props) {
    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-4 py-5 md:px-7 md:py-6">
            {header}
            <RefreshTransitionLayout
                isInitialLoad={isInitialLoad}
                isRefreshing={isRefreshing}
                dataVersion={dataVersion}
            >
                {error && <ErrorLayout error={error} />}
                {body}
            </RefreshTransitionLayout>
        </main>
    )
}
