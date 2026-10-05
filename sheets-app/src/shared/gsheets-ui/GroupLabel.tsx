import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/shared/lib/tw'

/** Implements FR3 of sheets-app-redesign: direction group label («Отправить в…» / «Получить из…») with a rule. */
export function GroupLabel({
    direction,
    children,
    className,
}: {
    direction: 'up' | 'down'
    children: string
    className?: string
}) {
    const Icon = direction === 'up' ? ArrowUp : ArrowDown
    return (
        <div data-testid="group-label" className={cn('flex items-center gap-2 text-ink-faint', className)}>
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="font-mono text-[10px] font-medium tracking-[0.14em] uppercase">{children}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>
    )
}
