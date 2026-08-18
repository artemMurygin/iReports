import { createZodDto } from 'nestjs-zod';
import { listEmployeesQuerySchema } from 'ireports-contracts';

export class ListEmployeesQueryDto extends createZodDto(
    listEmployeesQuerySchema,
) {}
