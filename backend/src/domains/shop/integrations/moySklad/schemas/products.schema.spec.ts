import { ProductSchema } from './products.schema';

// issue #47: products.schema.ts раньше вообще не читал `attributes` из
// МойСклада, в отличие от demands.schema.ts.
describe('ProductSchema', () => {
    const baseProduct = {
        id: 'product-1',
        name: 'iPhone 13',
        externalCode: 'ext-1',
        updated: '2026-01-01 00:00:00',
        archived: false,
    };

    it('парсит attributes товара, если МойСклад их прислал', () => {
        const parsed = ProductSchema.parse({
            ...baseProduct,
            attributes: [
                {
                    meta: {
                        href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1/attributes/attr-1',
                        type: 'attributemetadata',
                        mediaType: 'application/json',
                    },
                    id: 'attr-1',
                    name: 'Серийный номер',
                    type: 'string',
                    value: 'SN123456',
                },
            ],
        });

        expect(parsed.attributes).toHaveLength(1);
        expect(parsed.attributes[0]).toMatchObject({
            id: 'attr-1',
            name: 'Серийный номер',
            type: 'string',
            value: 'SN123456',
        });
    });

    it('не падает и отдаёт пустой массив, если attributes отсутствуют в ответе', () => {
        const parsed = ProductSchema.parse(baseProduct);

        expect(parsed.attributes).toEqual([]);
    });
});
