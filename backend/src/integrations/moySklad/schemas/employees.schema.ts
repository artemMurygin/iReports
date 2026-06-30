import { z } from 'zod';

export const EmployeeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    externalCode: z.string(),
    updated: z.string(),
    archived: z.boolean(),

    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    middleName: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),

    position: z.string().optional().nullable(),

    group: z.object({ meta: z.object({ href: z.string() }) }).optional().nullable(),
  })
  .transform((d) => ({
    id: d.id,
    name: d.name,
    externalCode: d.externalCode,
    updatedAt: d.updated,
    archived: d.archived,
    firstName: d.firstName ?? null,
    lastName: d.lastName ?? null,
    middleName: d.middleName ?? null,
    email: d.email ?? null,
    phone: d.phone ?? null,
    position: d.position ?? null,
    groupHref: d.group?.meta.href ?? null,
  }));
