import { createZodDto } from 'nestjs-zod';
import { listSalesPlansQuerySchema } from 'ireports-contracts';

export class ShopSalesPlanListQueryDto extends createZodDto(
    listSalesPlansQuerySchema,
) {}
