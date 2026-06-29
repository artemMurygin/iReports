import { type ReactNode } from "react"
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx';
import { PageLoader } from '@/pages/ServicesAnalytics/components/PageLoader.tsx';

type Props = {
    isInitialLoad?: boolean
    animClass?: string
    blurClass?: string
    filterBar?: ReactNode
    error: string | null
    children?: ReactNode
}

export function FunnelReportServiceLayout({ isInitialLoad, animClass = '', blurClass = '', filterBar, error, children }: Props) {
    return (
        <main className="flex flex-col flex-1">
            {filterBar}
            {isInitialLoad ? (
                <PageLoader />
            ) : (
                <div className={`flex flex-col gap-6 p-6 ${animClass} ${blurClass}`}>
                    {error && <ErrorLayout error={error} />}
                    {children}
                </div>
            )}
        </main>
    )
}
