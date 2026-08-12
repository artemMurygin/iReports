import { createZodDto } from 'nestjs-zod';
import { getServiceFunnelReportQuerySchema } from 'ireports-contracts';

export class GetServiceFunnelReportQueryDto extends createZodDto(
    getServiceFunnelReportQuerySchema,
) {}
