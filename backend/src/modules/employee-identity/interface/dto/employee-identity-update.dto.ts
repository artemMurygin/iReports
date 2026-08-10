import { createZodDto } from 'nestjs-zod';
import { updateEmployeeIdentitySchema } from 'ireports-contracts';

export class EmployeeIdentityUpdateDto extends createZodDto(
    updateEmployeeIdentitySchema,
) {}
