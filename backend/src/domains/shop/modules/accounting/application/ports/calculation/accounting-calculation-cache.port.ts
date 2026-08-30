import { CalculationLine } from '@/shared/domain/calculation-line';

export interface ShopAccountingCalculationCacheEntry {
    freshnessStamp: string;
    factLines: CalculationLine[];
    prognoseLines: CalculationLine[];
    factTotal: number;
    prognoseTotal: number;
}

// Зеркало domains/service/modules/accounting/application/ports/
// accounting-calculation-cache.port.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимый порт для
// направления shop, без параметра direction. Ленивый кэш результата
// расчёта по ключу (period, employeeId) — сравнение freshnessStamp решает,
// отдать строку как есть или пересчитать и переписать её (см.
// domain/services/accounting-cache-freshness.ts).
export interface ShopAccountingCalculationCachePort {
    find(
        period: string,
        employeeId: number,
    ): Promise<ShopAccountingCalculationCacheEntry | null>;

    upsert(
        period: string,
        employeeId: number,
        entry: ShopAccountingCalculationCacheEntry,
    ): Promise<void>;

    // Ручное «пересчитать» и очистка при закрытии периода (закрытый период
    // больше не читает кэш, но оставлять устаревшие строки незачем).
    deleteByPeriod(period: string): Promise<void>;
}

export const SHOP_ACCOUNTING_CALCULATION_CACHE = Symbol(
    'SHOP_ACCOUNTING_CALCULATION_CACHE',
);
