import { createZodDto } from 'nestjs-zod';
import { createRoleRequestSchema } from 'ireports-contracts';

export class CreateRoleDto extends createZodDto(createRoleRequestSchema) {}
