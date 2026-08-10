import { createZodDto } from 'nestjs-zod';
import { listSalesPlansQuerySchema } from 'ireports-contracts';

export class SalesPlanListQueryDto extends createZodDto(
    listSalesPlansQuerySchema,
) {}
