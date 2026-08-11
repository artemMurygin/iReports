import { createZodDto } from 'nestjs-zod';
import { updateEmployeeHoursEntryRequestSchema } from 'ireports-contracts';

export class EmployeeHoursEntryUpdateDto extends createZodDto(
    updateEmployeeHoursEntryRequestSchema,
) {}
