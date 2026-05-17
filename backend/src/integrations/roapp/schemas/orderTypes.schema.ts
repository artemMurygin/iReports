import { z } from 'zod';
export const OrderTypesSchema = z.object({
  id: z.number(),
  title: z.string(),
});
