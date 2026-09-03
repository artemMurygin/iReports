import { createZodDto } from 'nestjs-zod';
import { updateSalesPlanOrderRequestSchema } from 'ireports-contracts';

export class ShopSalesPlanOrderUpdateDto extends createZodDto(
    updateSalesPlanOrderRequestSchema,
) {}
