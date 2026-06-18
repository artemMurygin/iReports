import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createServiceRequestSchema = z.object({
  category_id: z.number(),
  earnings_sum: z.number(),
  prices: z.record(z.string(), z.number()),
  title: z.string(),
  warranty: z.number(),
  warranty_period: z.number(),
});

export class CreateServiceDto extends createZodDto(
  createServiceRequestSchema,
) {}

export type CreateServiceRequest = z.infer<typeof createServiceRequestSchema>;

export const createServiceResponseSchema = z.object({
  entityId: z.number(),
});

export type CreateServiceResponse = z.infer<typeof createServiceResponseSchema>;
