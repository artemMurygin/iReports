import { createZodDto } from 'nestjs-zod';
import { getServicesAnalyticsQuerySchema } from 'ireports-contracts';

export class GetServicesAnalyticsQueryDto extends createZodDto(
    getServicesAnalyticsQuerySchema,
) {}
