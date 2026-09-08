import { createZodDto } from 'nestjs-zod';
import { listSalesPerformanceQuerySchema } from 'ireports-contracts';

export class SalesPerformanceListQueryDto extends createZodDto(
    listSalesPerformanceQuerySchema,
) {}
