import { Logger } from '@nestjs/common';

export type CategoryKey = 'iPhone' | 'MacBook' | 'Watch' | 'iPad' | 'AirPods';

export interface PriceListRow {
    name: string;
    price: string | number | null;
}

export interface CategoryGroup {
    category: CategoryKey;
    rows: PriceListRow[];
}

// Перенос `PriceMonitoringService.categorize`
// (src/TODO/priceMonitoring/priceMonitoring.service.ts:351) verbatim — регэкспы и их порядок не
// менялись ("не переносится" только мёртвый код рядом, см. PRD, раздел 3а).
// spec: shop/marketing#requirement-строки-прайс-листа-категоризируются-по-названию-товара-первое-совпадение-побеждает
export class RowCategorizationService {
    private readonly logger = new Logger(RowCategorizationService.name);

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
        const uncategorized: PriceListRow[] = [];

        for (const row of rows) {
            let matched = false;
            for (const rule of rules) {
                if (rule.patterns.some((p) => p.test(row.name))) {
                    if (!groups.has(rule.key)) groups.set(rule.key, []);
                    groups.get(rule.key)!.push(row);
                    matched = true;
                    break;
                }
            }
            if (!matched) uncategorized.push(row);
        }

        const result = Array.from(groups.entries()).map(([category, rows]) => ({
            category,
            rows,
        }));

        this.logger.log(
            `Категоризация: ${rows.length} строк -> ${result
                .map((g) => `${g.category}(${g.rows.length})`)
                .join(', ')}, без категории: ${uncategorized.length}`,
        );
        if (uncategorized.length > 0) {
            this.logger.warn(
                `Строки не подошли ни под одно правило категоризации (исключены из импорта): ${uncategorized
                    .map((r) => `"${r.name}"`)
                    .join(', ')}`,
            );
        }

        return result;
    }
}
