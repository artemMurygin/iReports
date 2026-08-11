import { createZodDto } from 'nestjs-zod';
import { listEmployeeHoursEntriesQuerySchema } from 'ireports-contracts';

export class EmployeeHoursEntryListQueryDto extends createZodDto(
    listEmployeeHoursEntriesQuerySchema,
) {}
