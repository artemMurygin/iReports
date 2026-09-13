import { cn } from '@/shared/lib/tw'

import type { FactPrognoseAmount } from 'ireports-contracts'

import { LedgerHero } from './LedgerHero.tsx'

export type TotalsBentoCardProps = {
    grandTotal: FactPrognoseAmount
    isClosed: boolean
    className?: string
}

/**
 * Карточка «Итого» левой колонки бенто-раскладки сотрудника (Pencil:
 * `design/sallary-first-iteration.pen`, узел `YCxrT`'s `WJ4ES`'s `Jvgb2` "Итого" — десктоп,
 * `L2Ztk`'s `R8f8C` — мобайл). Раньше `LedgerHero` жил прямо внутри `LedgerCard` без собственной
 * рамки — саму рамку рисовала обёртка `LedgerCard` вокруг героя и блоков направлений вместе. В
 * бенто-раскладке "Итого" — самостоятельная карточка, отдельная от карточки "Источник · Задачи"
 * рядом с ней, поэтому ей нужна собственная рамка (`rounded-xl border-hairline bg-surface`, тот же
 * набор токенов, что и у соседних карточек `Jvgb2`/`ydIk9`/`aB1Lq`).
 *
 * Это ТОЛЬКО обёртка — расчёт факта/прогноза/дельты и сама разметка героя остаются в `LedgerHero`
 * (`grandTotal`/`isClosed` передаются ему без изменений), логика героя здесь не копируется.
 */
export function TotalsBentoCard({ grandTotal, isClosed, className }: TotalsBentoCardProps) {
    return (
        <div
            data-slot="totals-bento-card"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <LedgerHero grandTotal={grandTotal} isClosed={isClosed} />
        </div>
    )
}
