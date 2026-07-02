import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getCategoriesSchema = z.object({
  direction: z.enum(['SERVICE', 'SHOP']),
});

export class GetCategoriesDto extends createZodDto(getCategoriesSchema) {}
