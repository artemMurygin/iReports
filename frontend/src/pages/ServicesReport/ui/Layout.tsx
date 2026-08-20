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

export function Layout({ isInitialLoad, isRefreshing = false, dataVersion = 0, header, error, body }: Props) {
    return (
        <main className="flex flex-col flex-1">
            {header}
            <RefreshTransitionLayout
                isInitialLoad={isInitialLoad}
                isRefreshing={isRefreshing}
                dataVersion={dataVersion}
                className="flex flex-col gap-6 p-6"
            >
                {error && <ErrorLayout error={error} />}
                {body}
            </RefreshTransitionLayout>
        </main>
    )
}
