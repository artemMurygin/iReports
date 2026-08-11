import { createZodDto } from 'nestjs-zod';
import { createTaskCompletionRequestSchema } from 'ireports-contracts';

export class ShopTaskCompletionCreateDto extends createZodDto(
    createTaskCompletionRequestSchema,
) {}
