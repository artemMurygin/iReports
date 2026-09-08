import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { TargetOption } from '@/features/TargetDirectory'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Chip } from '@/shared/ui-kit/atoms/Chip'

export type TargetFilterSheetProps = {
    icon: ReactNode
    /** "Отдел"/"Сотрудник" — chip prefix and sheet title. */
    label: string
    options: TargetOption[]
    value: number | null
    onValueChange: (value: number | null) => void
    isLoading?: boolean
    className?: string
}

const ALL_LABEL = 'все'

/**
 * Pencil: design/sallary-first-iteration.pen, node `qJ0qx` → `Filter Chips` (`vSH2p`) — mobile-only
 * "Отдел"/"Сотрудник" filter chips (`kWq8G`/`xSzmQ`, both `ERP/Atom/Chip` instances). The mockup
 * doesn't include the expanded/open state for these chips, so the picker here follows the same
 * staged-selection bottom-sheet pattern already established by
 * `pages/SalaryRules/ui/CategoryBottomSheet.tsx`, simplified to a flat list (department/employee
 * aren't a tree, unlike that component's product catalog) — same "Сбросить"/"Применить" footer,
 * same re-seed-`staged`-on-open convention.
 */
export function TargetFilterSheet({
    icon,
    label,
    options,
    value,
    onValueChange,
    isLoading,
    className,
}: TargetFilterSheetProps) {
    const [open, setOpen] = useState(false)
    const [staged, setStaged] = useState<number | null>(value)

    function handleOpenChange(next: boolean) {
        setOpen(next)
        if (next) setStaged(value)
    }

    function applyStaged() {
        onValueChange(staged)
        setOpen(false)
    }

    const selectedLabel =
        value === null ? ALL_LABEL : (options.find((option) => option.id === value)?.name ?? ALL_LABEL)

    return (
        <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
            <DialogPrimitive.Trigger asChild>
                <Chip icon={icon} onClick={() => handleOpenChange(true)} disabled={isLoading} className={className}>
                    {label}: {isLoading ? '…' : selectedLabel}
                </Chip>
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
                <DialogPrimitive.Content
                    className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border-t border-hairline bg-surface shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-8"
                    aria-describedby={undefined}
                >
                    <DialogPrimitive.Title className="p-4 font-ui text-sm font-semibold text-ink">
                        {label}
                    </DialogPrimitive.Title>

                    <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
                        <button
                            type="button"
                            onClick={() => setStaged(null)}
                            className={cn(
                                'flex w-full items-center justify-between gap-1.5 rounded-[8px] px-2.5 py-[9px] text-left transition-colors',
                                staged === null ? 'bg-brand-soft' : 'hover:bg-canvas',
                            )}
                        >
                            <span
                                className={cn(
                                    'font-ui text-[14px]',
                                    staged === null ? 'font-semibold text-ink' : 'font-medium text-ink',
                                )}
                            >
                                Все
                            </span>
                            {staged === null && <Check className="size-4 shrink-0 text-brand-strong" />}
                        </button>
                        {options.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setStaged(option.id)}
                                className={cn(
                                    'flex w-full items-center justify-between gap-1.5 rounded-[8px] px-2.5 py-[9px] text-left transition-colors',
                                    staged === option.id ? 'bg-brand-soft' : 'hover:bg-canvas',
                                )}
                            >
                                <span
                                    className={cn(
                                        'truncate font-ui text-[14px]',
                                        staged === option.id ? 'font-semibold text-ink' : 'font-medium text-ink',
                                    )}
                                >
                                    {option.name}
                                </span>
                                {staged === option.id && <Check className="size-4 shrink-0 text-brand-strong" />}
                            </button>
                        ))}
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-hairline p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <button
                            type="button"
                            onClick={() => setStaged(null)}
                            className="shrink-0 font-ui text-sm font-semibold text-ok-ink"
                        >
                            Сбросить
                        </button>
                        <Button type="button" onClick={applyStaged} className="flex-1">
                            <Check />
                            Применить
                        </Button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
