import { cn } from '@/shared/lib/tw'

/** Implements FR2, FR8 of sheets-app-redesign: mono uppercase eyebrow label over a section. */
export function SectionHeader({ children, className }: { children: string; className?: string }) {
    return (
        <h2 className={cn('font-mono text-[10px] font-medium tracking-[0.14em] text-ink-faint uppercase', className)}>
            {children}
        </h2>
    )
}
