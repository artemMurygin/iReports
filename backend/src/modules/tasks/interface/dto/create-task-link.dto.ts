import { createZodDto } from 'nestjs-zod';
import { createTaskLinkRequestSchema } from 'ireports-contracts';

export class CreateTaskLinkDto extends createZodDto(
    createTaskLinkRequestSchema,
) {}
