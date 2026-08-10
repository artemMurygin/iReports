import { createZodDto } from 'nestjs-zod';
import { listSalesPlanTemplatesQuerySchema } from 'ireports-contracts';

export class SalesPlanTemplateListQueryDto extends createZodDto(
    listSalesPlanTemplatesQuerySchema,
) {}
