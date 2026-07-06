import { C_NEGATIVE, C_NEUTRAL, C_POSITIVE, CHART_COLORS } from '@/kernel/chartColors.ts'

export const TOP_N = 5

export const TOP_COLORS = CHART_COLORS.slice(0, TOP_N)
export const MUTED_STROKE = C_NEUTRAL
export const TREND_UP = C_POSITIVE
export const TREND_DOWN = C_NEGATIVE
export const TREND_NEUTRAL = C_NEUTRAL
