import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { cn } from '@/shared/lib/tw'

interface InfoTooltipProps {
    children: ReactNode
    className?: string
}

// Reproduces the reference sidebar's .info-tooltip (frontend/GoogleSheetsInterface/index.html
// lines ~213-258): a small circular "i" icon that reveals a dark, left-aligned info panel
// positioned top-right of the icon. Built on shadcn's Tooltip (Radix-backed) rather than the
// reference's hover-only CSS, so it also opens on keyboard focus.
export function InfoTooltip({ children, className }: InfoTooltipProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label="Подробнее"
                    className={cn(
                        'inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full bg-[#eee] text-xs font-bold text-[#666] italic select-none',
                        className,
                    )}
                >
                    i
                </button>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
                align="end"
                sideOffset={6}
                className="w-60 rounded-lg border-none bg-[#333] px-3 py-2.5 text-left text-[11.5px] leading-[1.5] font-normal text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
            >
                {children}
            </TooltipContent>
        </Tooltip>
    )
}
