import { createZodDto } from 'nestjs-zod';
import { putSalesPlanTemplateRequestSchema } from 'ireports-contracts';

export class ShopSalesPlanTemplatePutDto extends createZodDto(
    putSalesPlanTemplateRequestSchema,
) {}
