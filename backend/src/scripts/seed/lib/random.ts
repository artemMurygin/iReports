// Детерминированный ГПСЧ (mulberry32) поверх строкового seed — один и тот же
// id/строка всегда даёт один и тот же набор синтетических значений между
// перезапусками экспорта, поэтому анонимизированные фикстуры стабильны и не
// меняются в диффе при повторной генерации без изменений в исходной БД.
function hashSeed(seed: string): number {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}

export function createRng(seed: string): () => number {
    let a = hashSeed(seed);
    return function mulberry32() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function pick<T>(items: readonly T[], seed: string, salt = ''): T {
    const rng = createRng(seed + salt);
    return items[Math.floor(rng() * items.length)];
}

export function digits(seed: string, count: number, salt = ''): string {
    const rng = createRng(seed + salt);
    let out = '';
    for (let i = 0; i < count; i++) out += Math.floor(rng() * 10).toString();
    return out;
}
