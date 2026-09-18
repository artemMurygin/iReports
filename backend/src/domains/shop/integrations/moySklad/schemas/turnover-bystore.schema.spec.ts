import { TurnoverByStoreRowSchema } from './turnover-bystore.schema';

// GET /report/turnover/bystore?filter=product=<href> — шаг 2 бэкфилла исторической
// себестоимости остатка, разбивка по складам (design.md D1,
// fix-shop-turnover-historical-stock-cost).
describe('TurnoverByStoreRowSchema', () => {
    const baseRow = {
        assortment: {
            meta: {
                href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                type: 'product',
            },
        },
        stockByStore: [
            {
                store: {
                    meta: {
                        href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-1',
                    },
                },
                onPeriodEnd: {
                    quantity: 3,
                    sum: 90000,
                },
            },
        ],
    };

    it('парсит assortment.meta.href/type и stockByStore[].{store.meta.href, onPeriodEnd.quantity, onPeriodEnd.sum}', () => {
        const parsed = TurnoverByStoreRowSchema.parse(baseRow);

        expect(parsed.assortment.meta.href).toBe(baseRow.assortment.meta.href);
        expect(parsed.assortment.meta.type).toBe('product');
        expect(parsed.stockByStore).toHaveLength(1);
        expect(parsed.stockByStore[0].store.meta.href).toBe(
            baseRow.stockByStore[0].store.meta.href,
        );
        expect(parsed.stockByStore[0].onPeriodEnd).toEqual({
            quantity: 3,
            sum: 90000,
        });
    });

    it('парсит несколько складов в stockByStore одного товара', () => {
        const parsed = TurnoverByStoreRowSchema.parse({
            ...baseRow,
            stockByStore: [
                ...baseRow.stockByStore,
                {
                    store: {
                        meta: {
                            href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-2',
                        },
                    },
                    onPeriodEnd: { quantity: 1, sum: 30000 },
                },
            ],
        });

        expect(parsed.stockByStore).toHaveLength(2);
        expect(parsed.stockByStore[1].onPeriodEnd).toEqual({
            quantity: 1,
            sum: 30000,
        });
    });

    it('парсит пустой stockByStore (товар без остатка ни на одном складе)', () => {
        const parsed = TurnoverByStoreRowSchema.parse({
            ...baseRow,
            stockByStore: [],
        });

        expect(parsed.stockByStore).toEqual([]);
    });

    it('падает при отсутствии onPeriodEnd у записи stockByStore — поле обязательно в реальном ответе API', () => {
        expect(() =>
            TurnoverByStoreRowSchema.parse({
                ...baseRow,
                stockByStore: [{ store: baseRow.stockByStore[0].store }],
            }),
        ).toThrow();
    });
});
