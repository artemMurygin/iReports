import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const updateServicePricesInRoappItemSchema = z.object({
  id: z.number().int().positive(),
  price: z.number(),
  serviceCost: z.number(),
});

const updateServicePricesInRoappSchema = z.array(
  updateServicePricesInRoappItemSchema,
);

export class UpdateServicePricesInRoappDTO extends createZodDto(
  updateServicePricesInRoappSchema,
) {}

export type UpdateServicePricesInRoappItem = z.infer<
  typeof updateServicePricesInRoappItemSchema
>;
