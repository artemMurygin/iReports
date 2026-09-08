import { z } from 'zod';
export const MarketingSourcesSchema = z.object({
    id: z.number(),
    name: z.string(),
    branch_ids: z.array(z.number()).min(0),
});

export const MarketingSourcesShortSchema = MarketingSourcesSchema.pick({
    id: true,
    name: true,
});
