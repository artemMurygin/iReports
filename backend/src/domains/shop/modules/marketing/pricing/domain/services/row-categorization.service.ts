export type CategoryKey = 'iPhone' | 'MacBook' | 'Watch' | 'iPad' | 'AirPods';

export interface PriceListRow {
    name: string;
    price: string | number | null;
}

export interface CategoryGroup {
    category: CategoryKey;
    rows: PriceListRow[];
}

// Правила категоризации строк прайс-листа магазина — перенос
// `PriceMonitoringService.categorize` (src/TODO/priceMonitoring/priceMonitoring.service.ts:351)
// verbatim: регэкспы, их порядок и семантика "первое совпавшее правило побеждает,
// не подошедшая ни под одно правило строка теряется" не менялись (см. PRD, раздел 3а: "перенос
// regexp-правил categorize" — "не переносится" мёртвый код рядом, но сама бизнес-логика
// категоризации — как есть).
export class RowCategorizationService {
    categorize(rows: PriceListRow[]): CategoryGroup[] {
        const rules: { key: CategoryKey; patterns: RegExp[] }[] = [
            { key: 'iPhone', patterns: [/iphone/i] },
            { key: 'MacBook', patterns: [/macbook/i, /\bneo\b/i] },
            {
                key: 'Watch',
                patterns: [/apple\s+watch/i, /watch\s+(se|s\d+|ultra)/i],
            },
            { key: 'iPad', patterns: [/ipad/i, /iPro/i] },
            { key: 'AirPods', patterns: [/airpods/i] },
        ];

        const groups = new Map<CategoryKey, PriceListRow[]>();

        for (const row of rows) {
            for (const rule of rules) {
                if (rule.patterns.some((p) => p.test(row.name))) {
                    if (!groups.has(rule.key)) groups.set(rule.key, []);
                    groups.get(rule.key)!.push(row);
                    break;
                }
            }
        }

        return Array.from(groups.entries()).map(([category, rows]) => ({
            category,
            rows,
        }));
    }
}
