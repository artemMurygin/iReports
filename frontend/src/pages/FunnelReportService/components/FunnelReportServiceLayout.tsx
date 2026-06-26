import { type ReactNode } from "react"
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx';

type Props = {
    loading?: boolean
    filterBar?: ReactNode
    error: string | null
    children?: ReactNode
}

export function FunnelReportServiceLayout({ loading, filterBar, error, children }: Props) {
    return (
        <main className="flex flex-col flex-1">
            {filterBar}
            <div className={`flex flex-col gap-6 p-6 transition-opacity duration-150 ${loading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                {error && <ErrorLayout error={error} />}
                {children}
            </div>
        </main>
    )
}
