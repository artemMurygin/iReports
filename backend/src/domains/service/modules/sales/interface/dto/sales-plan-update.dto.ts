import { createZodDto } from 'nestjs-zod';
import { updateSalesPlanRequestSchema } from 'ireports-contracts';

export class SalesPlanUpdateDto extends createZodDto(
    updateSalesPlanRequestSchema,
) {}
