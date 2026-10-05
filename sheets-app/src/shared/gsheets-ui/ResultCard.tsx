import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/tw'

/** Implements FR7 of sheets-app-redesign: one label / mono value row of the result block. */
export function StatRow({ label, value }: { label: string; value: number | string }) {
    return (
        <div data-testid={`stat-${label}`} className="flex items-center justify-between py-[3px] text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono text-[13px] font-bold text-foreground">{value}</span>
        </div>
    )
}

export type ResultBadge = 'success' | 'errors' | 'default'

const BADGE: Record<ResultBadge, { variant: 'success' | 'danger' | 'default'; label: string }> = {
    success: { variant: 'success', label: 'Готово' },
    errors: { variant: 'danger', label: 'С ошибками' },
    default: { variant: 'default', label: 'Завершено' },
}

interface ResultCardProps {
    title: string
    stats: Array<{ label: string; value: number | string }>
    badge?: ResultBadge
    className?: string
    'data-testid'?: string
}

/**
 * Implements FR7 of sheets-app-redesign: per-function result block (title, Badge, StatRow list).
 * Rows are supplied by the caller, so «Валидных» / «Обновлено» can simply be omitted (Q15).
 */
export function ResultCard({ title, stats, badge = 'success', className, 'data-testid': testId }: ResultCardProps) {
    const { variant, label } = BADGE[badge]
    return (
        <section
            data-testid={testId}
            aria-label={title}
            className={cn('rounded-xl border bg-muted px-3 py-3', className)}
        >
            <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-bold text-foreground">{title}</h3>
                <Badge variant={variant}>{label}</Badge>
            </div>
            {stats.map((s) => (
                <StatRow key={s.label} label={s.label} value={s.value} />
            ))}
        </section>
    )
}
