import { createZodDto } from 'nestjs-zod';
import { rejectTaskCompletionRequestSchema } from 'ireports-contracts';

export class TaskCompletionRejectDto extends createZodDto(
    rejectTaskCompletionRequestSchema,
) {}
