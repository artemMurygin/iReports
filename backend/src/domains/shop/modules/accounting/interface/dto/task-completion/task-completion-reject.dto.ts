import { createZodDto } from 'nestjs-zod';
import { rejectTaskCompletionRequestSchema } from 'ireports-contracts';

export class ShopTaskCompletionRejectDto extends createZodDto(
    rejectTaskCompletionRequestSchema,
) {}
