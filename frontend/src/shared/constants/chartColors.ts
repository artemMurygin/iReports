// Semantic tokens — один смысл во всём дашборде
export const C_BRAND    = 'var(--c-brand)';    // объём, ранжированные бары, этапы воронки
export const C_POSITIVE = 'var(--c-positive)'; // успех, оплата, тренд вверх
export const C_NEGATIVE = 'var(--c-negative)'; // отказ, потеря, тренд вниз
export const C_NEUTRAL  = 'var(--c-neutral)';  // итого, нецелевые, нейтральный тренд, приглушённые линии
export const C_TRACK    = 'var(--c-track)';    // фон-дорожка под барами

// Категориальная палитра — только для графиков, где нужно различать несколько рядов
export const CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'var(--chart-6)',
] as const;

export const TOP_CHART_COLORS = CHART_COLORS.slice(0, 5) as readonly [string, string, string, string, string];
