import { createZodDto } from 'nestjs-zod';
import { renameRoleRequestSchema } from 'ireports-contracts';

export class RenameRoleDto extends createZodDto(renameRoleRequestSchema) {}
