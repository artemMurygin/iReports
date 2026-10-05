import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/shared/lib/tw'

interface DropzoneProps {
    title: string
    hint: string
    /** Lower-case extensions with a dot, e.g. `['.xlsx', '.xls']`. */
    accept: string[]
    onFile: (file: File) => void
    /** Called with a file whose extension is not accepted (UX2: format error). */
    onReject?: (file: File) => void
    invalid?: boolean
    disabled?: boolean
    'data-testid'?: string
    'data-input-testid'?: string
}

function isAccepted(file: File, accept: string[]): boolean {
    const name = file.name.toLowerCase()
    return accept.some((ext) => name.endsWith(ext))
}

/**
 * Implements FR2, UX2, UX6 of sheets-app-redesign: drag-and-drop / click file picker with default, hover,
 * drag-over and invalid-format states.
 */
export function Dropzone({
    title,
    hint,
    accept,
    onFile,
    onReject,
    invalid = false,
    disabled = false,
    'data-testid': testId,
    'data-input-testid': inputTestId,
}: DropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)

    function pick(file: File | undefined) {
        if (!file) return
        if (isAccepted(file, accept)) onFile(file)
        else onReject?.(file)
    }

    function open() {
        if (!disabled) inputRef.current?.click()
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        setDragOver(false)
        if (!disabled) pick(event.dataTransfer.files[0])
    }

    return (
        <>
            <div
                role="button"
                aria-label="Выбрать файл прайса"
                aria-disabled={disabled || undefined}
                data-testid={testId}
                data-state={invalid ? 'invalid' : dragOver ? 'drag-over' : 'default'}
                tabIndex={disabled ? -1 : 0}
                onClick={open}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        open()
                    }
                }}
                onDragOver={(event) => {
                    event.preventDefault()
                    setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                    'flex cursor-pointer flex-col items-center gap-1 rounded-xl border-[1.5px] px-4 py-5 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    invalid
                        ? 'border-danger-border bg-danger-soft'
                        : dragOver
                          ? 'border-brand bg-brand-soft'
                          : 'border-brand-border bg-brand-soft hover:border-brand',
                    disabled && 'pointer-events-none opacity-50',
                )}
            >
                <span
                    aria-hidden="true"
                    className="mb-2 flex size-[30px] items-center justify-center rounded-[9px] bg-card text-brand-strong"
                >
                    <Upload className="size-4" />
                </span>
                <p className="text-xs font-bold text-foreground">{title}</p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
            </div>
            <input
                ref={inputRef}
                type="file"
                data-testid={inputTestId}
                accept={accept.join(',')}
                className="hidden"
                onChange={(event) => {
                    pick(event.target.files?.[0])
                    event.target.value = ''
                }}
            />
        </>
    )
}
