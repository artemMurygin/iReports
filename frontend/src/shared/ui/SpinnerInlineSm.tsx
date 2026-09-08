import { Spinner } from '@/shared/ui/Spinner'

interface SpinnerInlineSmProps {
    label: string
}

export function SpinnerInlineSm({ label }: SpinnerInlineSmProps) {
    return (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Spinner className="w-3.5 h-3.5" />
            {label}
        </div>
    )
}
