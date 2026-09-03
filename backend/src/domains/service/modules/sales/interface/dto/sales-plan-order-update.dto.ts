import { createZodDto } from 'nestjs-zod';
import { updateSalesPlanOrderRequestSchema } from 'ireports-contracts';

export class SalesPlanOrderUpdateDto extends createZodDto(
    updateSalesPlanOrderRequestSchema,
) {}
