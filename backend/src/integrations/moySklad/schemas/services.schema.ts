import { z } from 'zod';

export const ServiceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string().optional().nullable(),
    externalCode: z.string(),
    description: z.string().optional().default(''),
    updated: z.string(),
    archived: z.boolean(),

    salePrices: z
      .array(
        z.object({
          value: z.number(),
          priceType: z.object({ name: z.string() }),
        }),
      )
      .optional()
      .default([]),

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
    description: d.description,
    updatedAt: d.updated,
    archived: d.archived,
    salePrice: d.salePrices[0]?.value ?? null,
    productFolderHref: d.productFolder?.meta.href ?? null,
  }));
