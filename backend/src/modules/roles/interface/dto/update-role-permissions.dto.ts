import { createZodDto } from 'nestjs-zod';
import { updateRolePermissionsRequestSchema } from 'ireports-contracts';

export class UpdateRolePermissionsDto extends createZodDto(
    updateRolePermissionsRequestSchema,
) {}
