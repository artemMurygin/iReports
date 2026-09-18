import { TurnoverAllRowSchema } from './turnover-all.schema';

// GET /report/turnover/all — шаг 1 бэкфилла исторической себестоимости остатка
// (design.md D1, fix-shop-turnover-historical-stock-cost).
describe('TurnoverAllRowSchema', () => {
    const baseRow = {
        assortment: {
            meta: {
                href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                type: 'product',
            },
        },
        onPeriodEnd: {
            quantity: 5,
            sum: 150000,
        },
    };

    it('парсит assortment.meta.href/type и onPeriodEnd.quantity/sum', () => {
        const parsed = TurnoverAllRowSchema.parse(baseRow);

        expect(parsed.assortment.meta.href).toBe(baseRow.assortment.meta.href);
        expect(parsed.assortment.meta.type).toBe('product');
        expect(parsed.onPeriodEnd.quantity).toBe(5);
        expect(parsed.onPeriodEnd.sum).toBe(150000);
    });

    it('парсит variant так же, как product (assortment.meta.type = "variant")', () => {
        const parsed = TurnoverAllRowSchema.parse({
            ...baseRow,
            assortment: {
                meta: {
                    href: 'https://api.moysklad.ru/api/remap/1.2/entity/variant/variant-1',
                    type: 'variant',
                },
            },
        });

        expect(parsed.assortment.meta.type).toBe('variant');
    });

    it('падает при отсутствии onPeriodEnd — поле обязательно в реальном ответе API', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- деструктуризация, чтобы исключить поле из объекта
        const { onPeriodEnd: _onPeriodEnd, ...rowWithoutOnPeriodEnd } = baseRow;

        expect(() =>
            TurnoverAllRowSchema.parse(rowWithoutOnPeriodEnd),
        ).toThrow();
    });

    it('сохраняет остальные поля строки ответа (passthrough)', () => {
        const parsed = TurnoverAllRowSchema.parse({
            ...baseRow,
            name: 'iPhone 13',
        });

        expect(parsed).toMatchObject({ name: 'iPhone 13' });
    });
});
