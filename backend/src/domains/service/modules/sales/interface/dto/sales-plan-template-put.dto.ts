import { createZodDto } from 'nestjs-zod';
import { putSalesPlanTemplateRequestSchema } from 'ireports-contracts';

export class SalesPlanTemplatePutDto extends createZodDto(
    putSalesPlanTemplateRequestSchema,
) {}
