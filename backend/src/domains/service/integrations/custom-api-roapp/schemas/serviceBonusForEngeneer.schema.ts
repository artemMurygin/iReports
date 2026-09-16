import { z } from 'zod';

export const ServiceBonusForEngeneerSchema = z
    .object({
        entityId: z.number(),
        fixedAmount: z.number(),
    })
    .transform((d) => ({
        id: d.entityId,
        bonus: d.fixedAmount,
    }));

export type ServiceBonusForEngeneer = z.infer<
    typeof ServiceBonusForEngeneerSchema
>;
