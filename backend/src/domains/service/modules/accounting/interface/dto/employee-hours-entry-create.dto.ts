import { createZodDto } from 'nestjs-zod';
import { createEmployeeHoursEntryRequestSchema } from 'ireports-contracts';

export class EmployeeHoursEntryCreateDto extends createZodDto(
    createEmployeeHoursEntryRequestSchema,
) {}
