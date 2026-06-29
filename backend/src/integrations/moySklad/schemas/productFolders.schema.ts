import { z } from 'zod';

export const ProductFolderSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    externalCode: z.string(),
    code: z.string().optional().nullable(),
    archived: z.boolean(),
    updated: z.string(),
    pathName: z.string(),
    productFolder: z
      .object({ meta: z.object({ href: z.string() }) })
      .optional()
      .nullable(),
  })
  .transform((d) => ({
    id: d.id,
    name: d.name,
    externalCode: d.externalCode,
    code: d.code ?? null,
    archived: d.archived,
    updatedAt: d.updated,
    pathName: d.pathName,
    parentId: d.productFolder?.meta.href.split('/').at(-1) ?? null,
    parentHref: d.productFolder?.meta.href ?? null,
  }));

export type ProductFolder = z.infer<typeof ProductFolderSchema>;
