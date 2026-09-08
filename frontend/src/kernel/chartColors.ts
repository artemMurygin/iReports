// Semantic tokens — один смысл во всём дашборде
export const C_BRAND = 'var(--c-brand)' // объём, ранжированные бары, этапы воронки
export const C_POSITIVE = 'var(--c-positive)' // успех, оплата, тренд вверх
export const C_NEGATIVE = 'var(--c-negative)' // отказ, потеря, тренд вниз
export const C_NEUTRAL = 'var(--c-neutral)' // итого, нецелевые, нейтральный тренд, приглушённые линии
export const C_TRACK = 'var(--c-track)' // фон-дорожка под барами

// Категориальная палитра — только для графиков, где нужно различать несколько рядов.
// Порядок и значения фиксированы макетом (design/sallary-first-iteration.pen) — это
// акцентные цвета карточек рядов в строчном порядке, не список к произвольной сортировке.
export const CHART_COLORS = [
    '#22C46A',
    '#2E7DD7',
    '#F5A524',
    '#E7000B',
    '#8B5CF6',
    '#14B8A6',
    '#EC4899',
    '#0EA5A5',
    '#F97316',
    '#6366F1',
] as const

export const TOP_CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
] as const
