import { createRng } from './random';

// Один и тот же seed (обычно id родительского документа — заказа, отгрузки,
// начисления) всегда даёт один и тот же коэффициент, поэтому суммы строк и
// суммы их родительского документа масштабируются согласованно и в
// анонимизированных фикстурах сохраняется правдоподобное соотношение "сумма
// позиций ≈ сумма документа", а не набор случайных несвязанных чисел.
export function moneyFactor(seed: string, spread = 0.12): number {
    const rng = createRng(seed + ':money');
    return 1 + (rng() * 2 - 1) * spread;
}

export function jitterAmount(
    value: number | null | undefined,
    factor: number,
): number | null {
    if (value === null || value === undefined) return null;
    const sign = Math.sign(value);
    const scaled = Math.round((Math.abs(value) * factor) / 10) * 10;
    return sign * scaled;
}

const AMOUNT_KEY = /amount|total|sum|turnover|margin/i;

function scaleUnknown(value: unknown, factor: number): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => scaleUnknown(item, factor));
    }
    if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(
            value as Record<string, unknown>,
        )) {
            result[key] =
                typeof val === 'number' && AMOUNT_KEY.test(key)
                    ? jitterAmount(val, factor)
                    : scaleUnknown(val, factor);
        }
        return result;
    }
    return value;
}

// factLines/prognoseLines/lines/sources — непрозрачные Json-поля с
// разбивкой по правилам мотивации (см. каталог схемы). Вместо разбора
// точного формата каждого из них масштабируем рекурсивно любое число под
// ключом, похожим на денежный — этого достаточно, чтобы после
// анонимизации разбивка оставалась в том же порядке величин, что и итог.
export function scaleJsonAmounts<T>(value: T, factor: number): T {
    return scaleUnknown(value, factor) as T;
}
