import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  parent_id: z.number().int().nullable(),
});

export type Category = z.infer<typeof CategorySchema>;
