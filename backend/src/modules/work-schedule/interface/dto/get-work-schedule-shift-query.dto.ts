import { createZodDto } from 'nestjs-zod';
import { workScheduleShiftQuerySchema } from 'ireports-contracts';

export class GetWorkScheduleShiftQueryDto extends createZodDto(
    workScheduleShiftQuerySchema,
) {}
