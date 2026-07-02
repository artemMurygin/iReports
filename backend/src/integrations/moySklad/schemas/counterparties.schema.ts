import { z } from 'zod';
import { MoneySchema } from './common.schema';

export const CounterpartySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    externalCode: z.string(),
    updated: z.string(),
    archived: z.boolean(),

    companyType: z.enum(['legal', 'entrepreneur', 'individual']),
    inn: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    actualAddress: z.string().optional().nullable(),

    salesAmount: MoneySchema.optional().nullable(),
  })
  .transform((d) => ({
    id: d.id,
    name: d.name,
    externalCode: d.externalCode,
    updatedAt: d.updated,
    archived: d.archived,
    companyType: d.companyType,
    inn: d.inn ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
    actualAddress: d.actualAddress ?? null,
    salesAmount: d.salesAmount ?? null,
  }));
