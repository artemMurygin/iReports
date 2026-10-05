import { FileSpreadsheet, X } from 'lucide-react'
import { IconButton } from '@/shared/ui/icon-button'
import { cn } from '@/shared/lib/tw'

interface FileCardProps {
    name: string
    onRemove: () => void
    disabled?: boolean
    className?: string
    'data-testid'?: string
}

/** Implements FR2, UX6 of sheets-app-redesign: selected-file card (icon, name, Remove) that replaces the Dropzone. */
export function FileCard({ name, onRemove, disabled, className, 'data-testid': testId }: FileCardProps) {
    return (
        <div
            data-testid={testId}
            className={cn(
                'flex items-center gap-3 rounded-xl border-[1.5px] border-brand-border bg-card px-3 py-3',
                className,
            )}
        >
            <span
                aria-hidden="true"
                className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand-soft text-brand-strong"
            >
                <FileSpreadsheet className="size-4" />
            </span>
            <span data-testid="file-name" className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {name}
            </span>
            <IconButton aria-label="Убрать файл" disabled={disabled} onClick={onRemove}>
                <X />
            </IconButton>
        </div>
    )
}
