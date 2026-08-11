import { createZodDto } from 'nestjs-zod';
import { listTaskCompletionsQuerySchema } from 'ireports-contracts';

export class ShopTaskCompletionListQueryDto extends createZodDto(
    listTaskCompletionsQuerySchema,
) {}
