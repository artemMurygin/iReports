import type { PeriodBreakdownEntry } from '@/kernel/types'
import { TrendSparkline } from '@/features/ServicesTable/ui/TrendSparkline.tsx'

interface Props {
    breakdown: PeriodBreakdownEntry[]
    /** `serviceId`-based id, passed through to `TrendSparkline`'s `<linearGradient>` so every row's
     * gradient stays unique in the DOM. */
    gradientId: string
}

/** Ячейка "Тренд" десктоп-таблицы (Pencil: `h7eHG` → `tmW21` "Table Section") — brand-strong
 * градиентная область поверх количества продаж по периодам, с тултипом на новых токенах. */
export function SparklineCell({ breakdown, gradientId }: Props) {
    return <TrendSparkline breakdown={breakdown} gradientId={gradientId} width={112} height={36} />
}
