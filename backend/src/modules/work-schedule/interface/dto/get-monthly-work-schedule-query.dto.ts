import { createZodDto } from 'nestjs-zod';
import { getMonthlyWorkScheduleQuerySchema } from 'ireports-contracts';

export class GetMonthlyWorkScheduleQueryDto extends createZodDto(
    getMonthlyWorkScheduleQuerySchema,
) {}
