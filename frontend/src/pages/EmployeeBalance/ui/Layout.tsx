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

/** Тот же приём, что `pages/SalaryAccrualDocument/ui/Layout.tsx`: единственный слот `body` —
 * шапка баланса собирается из уже загрученных данных, поэтому живёт внутри `body`, за тем же
 * гейтом `RefreshTransitionLayout`, а не в отдельном `header`. */
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
