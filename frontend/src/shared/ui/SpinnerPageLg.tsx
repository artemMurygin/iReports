import { Spinner } from '@/shared/ui/Spinner'

interface SpinnerPageLgProps {
    label: string
}

export function SpinnerPageLg({ label }: SpinnerPageLgProps) {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <Spinner className="w-12 h-12 text-gray-400" />
                <p className="text-sm font-medium text-gray-500">{label}</p>
            </div>
        </div>
    )
}