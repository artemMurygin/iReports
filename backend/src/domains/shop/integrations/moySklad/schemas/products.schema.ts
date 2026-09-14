import { z } from 'zod';
import { MoneySchema } from './common.schema';

const AttributeMetaSchema = z.object({
    href: z.string().url(),
    type: z.string(),
    mediaType: z.string(),
});

// Доп. поля (кастомные атрибуты) карточки товара МойСклад (issue #47) —
// используются для резолва закупщика БУ техники ("Онлайн-закупщик"/
// "Офлайн-закупщик", см. PURCHASER_ATTRIBUTE_NAME в
// sync/moySklad/moysklad-sync.mappers.ts и docs/payroll/
// prd-payroll-calculation.md, раздел "Роли магазина"). Конкретных атрибутов,
// требующих строгой валидации по литералам id/name (как
// ONLINE_MANAGER_ATTR_ID у отгрузки), здесь нет — id атрибута закупщика в
// проде неизвестен, резолв идёт по имени, поэтому схема читает attributes
// как есть, без литеральной привязки к конкретному id/типу.
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
