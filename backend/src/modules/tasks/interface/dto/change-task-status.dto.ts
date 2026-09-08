import { createZodDto } from 'nestjs-zod';
import { changeTaskStatusRequestSchema } from 'ireports-contracts';

export class ChangeTaskStatusDto extends createZodDto(
    changeTaskStatusRequestSchema,
) {}
