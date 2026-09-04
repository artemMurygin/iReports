import { createZodDto } from 'nestjs-zod';
import { reorderEmployeesRequestSchema } from 'ireports-contracts';

export class ReorderEmployeesDto extends createZodDto(
    reorderEmployeesRequestSchema,
) {}
