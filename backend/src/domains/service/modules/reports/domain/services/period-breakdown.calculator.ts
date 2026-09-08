import { ServiceSaleEntity } from '../entities/service-sale.entity';
import { PeriodBucket } from '../value-objects/period-bucket.value-object';

// Одна точка разбивки по периодам — форма 1:1 с buildPeriodBreakdown
// (src/TODO/reports/reports.service.ts). Не VO (нет собственных инвариантов
// сверх формы данных) — как и FunnelDealFacts в modules/sales, простой тип
// данных, которым обмениваются domain-сервис и application-слой.
export interface PeriodBreakdownEntry {
    period: string;
    count: number;
    avgPrice: number;
}

// Перенос buildPeriodBreakdown (src/TODO/reports/reports.service.ts).
// periods — уже сгенерированная последовательность ключей
// (PeriodBucket.generateKeys), передаётся отдельно от bucket, чтобы не
// пересчитывать её на каждую услугу в цикле вызывающего кода (см.
// GetServicesAnalyticsService — один generateKeys() на весь ответ, как и в
// легаси getServicesAnalytics).
export function buildPeriodBreakdown(
    rows: readonly ServiceSaleEntity[],
    periods: readonly string[],
    bucket: PeriodBucket,
): PeriodBreakdownEntry[] {
    const buckets = new Map<
        string,
        { count: number; priceWeightedSum: number }
    >();

    for (const row of rows) {
        const { closedAt, price, quantity } = row.getProps();
        const key = bucket.keyFor(closedAt);
        const entry = buckets.get(key) ?? { count: 0, priceWeightedSum: 0 };
        entry.count += quantity;
        entry.priceWeightedSum += price * quantity;
        buckets.set(key, entry);
    }

    // spec: service/reports#requirement-разбивка-по-периодам-содержит-все-периоды-диапазона-включая-пустые
    return periods.map((period) => {
        const entry = buckets.get(period);
        return {
            period,
            count: entry?.count ?? 0,
            // spec: service/reports#requirement-средняя-цена-услуги-средневзвешенная-по-количеству
            avgPrice:
                entry && entry.count > 0
                    ? Math.round(entry.priceWeightedSum / entry.count)
                    : 0,
        };
    });
}
