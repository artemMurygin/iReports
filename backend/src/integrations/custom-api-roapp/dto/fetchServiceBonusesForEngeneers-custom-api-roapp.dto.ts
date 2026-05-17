import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const serviceBonusesForEngeneersSchema = z
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

export class FetchServiceBonusesForEngeneersDto extends createZodDto(
  serviceBonusesForEngeneersSchema,
) {}

export type ServiceBonus = z.infer<typeof serviceBonusesForEngeneersSchema>;
export type ServiceBonuses = ServiceBonus[];
