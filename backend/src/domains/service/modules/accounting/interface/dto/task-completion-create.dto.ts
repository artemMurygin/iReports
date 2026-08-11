import { createZodDto } from 'nestjs-zod';
import { createTaskCompletionRequestSchema } from 'ireports-contracts';

export class TaskCompletionCreateDto extends createZodDto(
    createTaskCompletionRequestSchema,
) {}
