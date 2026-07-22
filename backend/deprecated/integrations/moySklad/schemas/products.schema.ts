import { z } from 'zod';
import { MoneySchema } from './common.schema';

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
      .object({ value: MoneySchema, currency: z.object({ meta: z.object({ href: z.string() }) }) })
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
  }));
