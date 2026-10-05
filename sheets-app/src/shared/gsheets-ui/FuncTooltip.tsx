import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { cn } from '@/shared/lib/tw'

export interface FuncTooltipContent {
    title: string
    body: string
    /** Only «пишет в …» (Q17): no time estimate, no clock icon. */
    meta: string
}

/**
 * Implements FR5 of sheets-app-redesign: Info Dot trigger with a dark rich tooltip (title, body, meta).
 * Opens on hover and keyboard focus; `max-w` 236px, z-50 above the list.
 */
export function InfoDot({ content, className }: { content: FuncTooltipContent; className?: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={`Подробнее: ${content.title}`}
                    className={cn(
                        'inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        className,
                    )}
                >
                    <Info className="size-3" />
                </button>
            </TooltipTrigger>
            <TooltipContent variant="rich" side="bottom" align="end" sideOffset={8} data-testid="func-tooltip">
                <p className="text-[13px] font-semibold">{content.title}</p>
                <p className="mt-1 text-tooltip-body">{content.body}</p>
                <p className="mt-2 font-mono text-[11px] text-tooltip-meta">{content.meta}</p>
            </TooltipContent>
        </Tooltip>
    )
}
