import { createZodDto } from 'nestjs-zod';
import { confirmTaskCompletionRequestSchema } from 'ireports-contracts';

export class TaskCompletionConfirmDto extends createZodDto(
    confirmTaskCompletionRequestSchema,
) {}
