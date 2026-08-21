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
 * Тот же набор слотов, что и `pages/WorkSchedule/ui/Layout.tsx` (см. её комментарий про
 * происхождение соглашения) — `mx-auto max-w-md` вместо адаптивных `md:px-*`, потому что узел
 * `A5SbT` — это ровно один макет 390px без отдельной десктопной раскладки: на широких экранах
 * контент остаётся телефонной колонкой по центру, а не растягивается в таблицу вкладки
 * «Календарь» (та уже есть на `/work-schedule`).
 */
export function Layout({ isInitialLoad, isRefreshing = false, dataVersion = 0, header, error, body }: Props) {
    return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 bg-canvas px-4 py-4">
            {header}
            <RefreshTransitionLayout isInitialLoad={isInitialLoad} isRefreshing={isRefreshing} dataVersion={dataVersion}>
                {error && <ErrorLayout error={error} />}
                {body}
            </RefreshTransitionLayout>
        </main>
    )
}
