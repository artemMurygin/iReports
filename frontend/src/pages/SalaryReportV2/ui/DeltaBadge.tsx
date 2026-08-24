import { cn } from '@/shared/lib/tw'

import type { DeltaTone } from '../model/deltaTone.ts'

const DELTA_TONE_CLASSES: Record<DeltaTone, string> = {
    positive: 'bg-brand-soft text-ok-ink',
    negative: 'bg-danger-soft text-danger',
    warning: 'bg-warn-soft text-warn-ink',
}

/**
 * Плашка дельты прогноза (Pencil: `H7Mz74`'s `Pkp9B` "Дельта" / `UO4LK`'s аналог у отдела —
 * `ERP/Atom/Badge` инстанс) — общая для героя карточки-гроссбуха сотрудника (`LedgerHero`) и
 * отдела (`DepartmentLedgerHeroV2`), тон считает `model/deltaTone.ts`'s `getDeltaTone`.
 */
export function DeltaBadge({ tone, children }: { tone: DeltaTone; children: string }) {
    return (
        <span
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                DELTA_TONE_CLASSES[tone],
            )}
        >
            {children}
        </span>
    )
}
