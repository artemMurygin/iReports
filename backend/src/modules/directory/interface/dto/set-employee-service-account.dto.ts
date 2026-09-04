import { createZodDto } from 'nestjs-zod';
import { setEmployeeServiceAccountRequestSchema } from 'ireports-contracts';

export class SetEmployeeServiceAccountDto extends createZodDto(
    setEmployeeServiceAccountRequestSchema,
) {}
