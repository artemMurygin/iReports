import { createZodDto } from 'nestjs-zod';
import { updateSalesPlanRequestSchema } from 'ireports-contracts';

export class ShopSalesPlanUpdateDto extends createZodDto(
    updateSalesPlanRequestSchema,
) {}
