import { cn } from '@/shared/lib/tw'

interface GlassLoaderProps {
    active: boolean
    title?: string
    statusText: string
    logLines: string[]
}

// Reproduces the reference sidebar's #glassLoader/.loader-card/.loader-ring/.loader-log
// (frontend/GoogleSheetsInterface/index.html lines ~17-176, ~268-278). The overlay stays
// mounted at all times and is only toggled via opacity/pointer-events, matching how the
// reference toggles the `.active` class instead of adding/removing the node.
export function GlassLoader({ active, title = 'Синхронизация', statusText, logLines }: GlassLoaderProps) {
    const latestIndex = logLines.length - 1

    return (
        <div
            role="status"
            aria-live="polite"
            aria-hidden={!active}
            className={cn(
                'fixed inset-0 z-[999] flex items-start justify-center bg-white/55 pt-10 backdrop-blur-[10px] transition-opacity duration-[250ms] ease-in-out',
                active ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
            )}
        >
            <div
                className={cn(
                    'flex w-[260px] flex-col items-center rounded-[22px] border border-white/70 bg-white/92 pt-5 pr-4 pb-4 pl-4 shadow-[0_10px_40px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]',
                    active && 'animate-loader-popup',
                )}
            >
                <div className="relative mb-3.5 h-[52px] w-[52px] shrink-0 animate-loader-spin rounded-full bg-[conic-gradient(from_0deg,#4CAF50,#7be27f,#4CAF50)]">
                    <div className="absolute inset-[5px] rounded-full bg-white/95" />
                </div>

                <div className="mb-1 text-center text-sm font-bold text-[#222]">
                    {title}
                    <span className="loader-dots" />
                </div>
                <div className="mb-3 min-h-[16px] text-center text-xs leading-[1.4] text-[#555]">{statusText}</div>

                <div className="mb-2.5 h-px w-full bg-black/[0.07]" />

                <div className="flex max-h-[110px] w-full flex-col gap-1 overflow-y-auto">
                    {logLines.map((line, index) => (
                        <div
                            key={`${index}-${line}`}
                            className={cn(
                                'flex animate-loader-log-fade-in items-start gap-[5px] text-[11px] leading-[1.35] text-[#888]',
                                index === latestIndex && 'font-semibold text-[#333]',
                            )}
                        >
                            <span className="mt-px shrink-0">&rsaquo;</span>
                            <span>{line}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
