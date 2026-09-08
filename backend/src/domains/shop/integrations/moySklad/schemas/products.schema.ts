import { z } from 'zod';
import { MoneySchema } from './common.schema';

const AttributeMetaSchema = z.object({
    href: z.string().url(),
    type: z.string(),
    mediaType: z.string(),
});

// Доп. поля (кастомные атрибуты) карточки товара МойСклад (issue #47) — до
// сих пор `products.schema.ts` вообще не читал `attributes`, в отличие от
// `demands.schema.ts`. Конкретных атрибутов уровня товара, требующих
// строгой валидации по литералам id/name (как ONLINE_MANAGER_ATTR_ID у
// отгрузки), сейчас нет: закупщики БУ техники лежат на уровне товарной
// позиции отгрузки, а не карточки товара (см.
// docs/payroll/prd-payroll-calculation.md, раздел "Роли магазина"), поэтому
// схема читает attributes как есть — инфраструктурная возможность синка
// товаров, а не разбор конкретного известного поля.
const ProductAttributeSchema = z.object({
    meta: AttributeMetaSchema,
    id: z.string(),
    name: z.string(),
    type: z.string(),
    value: z.unknown(),
});

export type ProductAttribute = z.infer<typeof ProductAttributeSchema>;

export const ProductSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        code: z.string().optional().nullable(),
        externalCode: z.string(),
        article: z.string().optional().nullable(),
        description: z.string().optional().default(''),
        updated: z.string(),
        archived: z.boolean(),
        attributes: z.array(ProductAttributeSchema).optional(),

        salePrices: z
            .array(
                z.object({
                    value: MoneySchema,
                    priceType: z.object({ name: z.string() }),
                }),
            )
            .optional()
            .default([]),

        buyPrice: z
            .object({
                value: MoneySchema,
                currency: z.object({ meta: z.object({ href: z.string() }) }),
            })
            .optional()
            .nullable(),

        productFolder: z
            .object({ meta: z.object({ href: z.string() }) })
            .optional()
            .nullable(),
    })
    .transform((d) => ({
        id: d.id,
        name: d.name,
        code: d.code ?? null,
        externalCode: d.externalCode,
        article: d.article ?? null,
        description: d.description,
        updatedAt: d.updated,
        archived: d.archived,
        salePrice: d.salePrices[0]?.value ?? null,
        buyPrice: d.buyPrice?.value ?? null,
        productFolderHref: d.productFolder?.meta.href ?? null,
        attributes: d.attributes ?? [],
    }));
