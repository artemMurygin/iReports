import { createZodDto } from 'nestjs-zod';
import { listTaskCompletionsQuerySchema } from 'ireports-contracts';

export class TaskCompletionListQueryDto extends createZodDto(
    listTaskCompletionsQuerySchema,
) {}
