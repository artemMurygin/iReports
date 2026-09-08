import { createZodDto } from 'nestjs-zod';
import { createEmployeeIdentitySchema } from 'ireports-contracts';

export class EmployeeIdentityCreateDto extends createZodDto(
    createEmployeeIdentitySchema,
) {}
