import { z } from 'zod';

export const ServiceBonusForEngeneerSchema = z
  .object({
    id: z.number(),
    objectId: z.number(),
    title: z.string(),
    earningsSum: z.number(),
    earningsPctBasis: z.number(),
    type: z.number(),
  })
  .transform((d) => ({
    id: d.objectId,
    bonus: d.earningsSum,
  }));

export type ServiceBonusForEngeneer = z.infer<
  typeof ServiceBonusForEngeneerSchema
>;
