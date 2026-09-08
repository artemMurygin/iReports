import {
    PriceListRow,
    RowCategorizationService,
} from './row-categorization.service';

function row(name: string, price: string | number | null = null): PriceListRow {
    return { name, price };
}

describe('RowCategorizationService', () => {
    let service: RowCategorizationService;

    beforeEach(() => {
        service = new RowCategorizationService();
    });

    it('распределяет строки по категориям iPhone/MacBook/Watch/iPad/AirPods', () => {
        const rows = [
            row('Apple iPhone 16 Pro Max 256GB Desert Titanium', 129990),
            row('Apple MacBook Air 13" Midnight (M5, 16GB, 512GB)', 189990),
            row('Apple Neo 14" (M5 Pro, 24GB, 1TB)', 259990),
            row('Apple Watch Series 11 42mm Black (Sport Band Black)', 44990),
            row('Apple Watch SE 40mm', 24990),
            row('Apple Watch Ultra 2 49mm', 89990),
            row('Apple iPad Air 11" Space Gray Wi-Fi 128GB (M4, 2026)', 74990),
            row('Apple iPro 13" 1TB', 154990),
            row('Apple AirPods Pro 3', 24990),
        ];

        const groups = service.categorize(rows);
        const byCategory = new Map(groups.map((g) => [g.category, g.rows]));

        expect(byCategory.get('iPhone')?.map((r) => r.name)).toEqual([
            'Apple iPhone 16 Pro Max 256GB Desert Titanium',
        ]);
        expect(byCategory.get('MacBook')?.map((r) => r.name)).toEqual([
            'Apple MacBook Air 13" Midnight (M5, 16GB, 512GB)',
            'Apple Neo 14" (M5 Pro, 24GB, 1TB)',
        ]);
        expect(byCategory.get('Watch')?.map((r) => r.name)).toEqual([
            'Apple Watch Series 11 42mm Black (Sport Band Black)',
            'Apple Watch SE 40mm',
            'Apple Watch Ultra 2 49mm',
        ]);
        expect(byCategory.get('iPad')?.map((r) => r.name)).toEqual([
            'Apple iPad Air 11" Space Gray Wi-Fi 128GB (M4, 2026)',
            'Apple iPro 13" 1TB',
        ]);
        expect(byCategory.get('AirPods')?.map((r) => r.name)).toEqual([
            'Apple AirPods Pro 3',
        ]);
    });

    it('регистронезависима', () => {
        const groups = service.categorize([row('APPLE IPHONE 15 128GB')]);

        expect(groups).toEqual([
            {
                category: 'iPhone',
                rows: [{ name: 'APPLE IPHONE 15 128GB', price: null }],
            },
        ]);
    });

    it('строка, не подошедшая ни под одно правило, теряется (как в легаси)', () => {
        const groups = service.categorize([
            row('Зарядный кабель USB-C 1m'),
            row('Apple iPhone 16 128GB', 89990),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].category).toBe('iPhone');
    });

    it('"watch" без "apple" и без se/sN/ultra не попадает в категорию Watch', () => {
        const groups = service.categorize([
            row('Ремешок для watch классический'),
        ]);

        expect(groups).toHaveLength(0);
    });

    it('первое подошедшее правило побеждает — порядок правил сохранён', () => {
        // "iPro" матчится под iPad-паттерн /iPro/i, даже без явного упоминания iPad.
        const groups = service.categorize([row('Apple iPro Display XDR')]);

        expect(groups).toEqual([
            {
                category: 'iPad',
                rows: [{ name: 'Apple iPro Display XDR', price: null }],
            },
        ]);
    });

    it('пустой список строк даёт пустой список групп', () => {
        expect(service.categorize([])).toEqual([]);
    });
});
