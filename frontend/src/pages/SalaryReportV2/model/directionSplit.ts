import { SALARY_DIRECTION_LABELS, type SalaryDirection } from '@/features/SalaryReportData'

import type { DepartmentDirectionBreakdown } from './useDepartmentSalaryReportAll.ts'

export type DirectionSplitSegment = {
    direction: SalaryDirection
    label: string
    amount: number
    /** Целое 0-100, округлено `Math.round` — сумма двух сегментов может быть 99/101 на стыке
     * округления, для узкой полосы-индикатора это не имеет значения. */
    percent: number
}

/**
 * Строит вьюмодель Split Bar + Legend (Pencil `eMEyq/I3gfR1`+`eMEyq/nC8in`) из сырых сумм
 * направлений — доли по факту (`total.fact`), т.к. герой-карточка над полосой уже показывает факт
 * как главную цифру ("Начислено всего · факт"), а не прогноз. `null`, если сумма факта по обоим
 * направлениям — 0 (нечего делить на полосе, отрицательные суммы отсекаются `Math.max(..., 0)`,
 * т.к. полоса-индикатор физически не может нарисовать отрицательную ширину сегмента).
 */
export function buildDirectionSplit(breakdown: DepartmentDirectionBreakdown): DirectionSplitSegment[] | null {
    const serviceAmount = Math.max(breakdown.service.fact, 0)
    const shopAmount = Math.max(breakdown.shop.fact, 0)
    const total = serviceAmount + shopAmount
    if (total <= 0) return null

    return [
        {
            direction: 'service',
            label: SALARY_DIRECTION_LABELS.service,
            amount: serviceAmount,
            percent: Math.round((serviceAmount / total) * 100),
        },
        {
            direction: 'shop',
            label: SALARY_DIRECTION_LABELS.shop,
            amount: shopAmount,
            percent: Math.round((shopAmount / total) * 100),
        },
    ]
}
