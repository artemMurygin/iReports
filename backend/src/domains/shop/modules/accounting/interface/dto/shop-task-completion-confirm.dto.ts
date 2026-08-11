import { createZodDto } from 'nestjs-zod';
import { confirmTaskCompletionRequestSchema } from 'ireports-contracts';

export class ShopTaskCompletionConfirmDto extends createZodDto(
    confirmTaskCompletionRequestSchema,
) {}
