import { type ReactNode } from 'react'
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx'
import { SpinnerPageLg } from '@/shared/ui/SpinnerPageLg'

type Props = {
    isInitialLoad?: boolean
    animClass?: string
    blurClass?: string
    header?: ReactNode
    error: string | null
    body?: ReactNode
}

export function FunnelReportServiceLayout({
    isInitialLoad,
    animClass = '',
    blurClass = '',
    header,
    error,
    body,
}: Props) {
    return (
        <main className="flex flex-col flex-1">
            {header}
            {isInitialLoad ? (
                <SpinnerPageLg label="Загрузка данных..." />
            ) : (
                <div className={`flex flex-col gap-6 p-6 ${animClass} ${blurClass}`}>
                    {error && <ErrorLayout error={error} />}
                    {body}
                </div>
            )}
        </main>
    )
}
