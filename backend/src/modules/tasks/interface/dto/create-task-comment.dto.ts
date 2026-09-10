import { createZodDto } from 'nestjs-zod';
import { createTaskCommentRequestSchema } from 'ireports-contracts';

export class CreateTaskCommentDto extends createZodDto(
    createTaskCommentRequestSchema,
) {}
