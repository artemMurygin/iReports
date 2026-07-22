import { z } from 'zod';

export const OrderStatusesSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    color: z.string(),
    group: z.object({
      type: z.number().int(),
      name: z.string(),
    }),
  })
  .transform((data) => ({
    id: data.id,
    name: data.name,
    color: data.color,
    group: data.group.name,
  }));
