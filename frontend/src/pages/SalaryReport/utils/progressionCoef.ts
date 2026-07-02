import type { ProgressionTier } from '../types'

// Клиентское зеркало backend/src/salary/calculation/progression-coef.ts — только для
// живого превью кривой в конструкторе, реальный расчёт всегда выполняет бэкенд.
export function progressionCoef(pct: number, tiers: ProgressionTier[]): number {
    const tier = tiers.find((t) => pct >= t.fromPct && (t.toPct == null || pct < t.toPct))
    if (!tier) return 1

    switch (tier.mode) {
        case 'FIXED':
        case 'MULTIPLIER':
            return tier.coef ?? 1
        case 'LINEAR': {
            const span = (tier.toPct ?? tier.fromPct) - tier.fromPct
            const k = span === 0 ? 0 : (pct - tier.fromPct) / span
            const from = tier.coefFrom ?? 0
            const to = tier.coefTo ?? 0
            return from + (to - from) * k
        }
    }
}
