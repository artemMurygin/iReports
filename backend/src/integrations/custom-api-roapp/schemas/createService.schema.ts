import { z } from 'zod';

export const CreateServiceRequestSchema = z.object({
  category_id: z.number(),
  earnings_sum: z.number(),
  prices: z.record(z.string(), z.number()),
  title: z.string(),
  warranty: z.number(),
  warranty_period: z.number(),
});

export type CreateServiceRequest = z.infer<typeof CreateServiceRequestSchema>;

export const CreateServiceResponseSchema = z.object({
  entityId: z.number(),
});

export type CreateServiceResponse = z.infer<
  typeof CreateServiceResponseSchema
>;
