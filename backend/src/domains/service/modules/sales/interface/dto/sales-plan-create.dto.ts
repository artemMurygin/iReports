import { createZodDto } from 'nestjs-zod';
import { createSalesPlanRequestSchema } from 'ireports-contracts';

export class SalesPlanCreateDto extends createZodDto(
    createSalesPlanRequestSchema,
) {}
