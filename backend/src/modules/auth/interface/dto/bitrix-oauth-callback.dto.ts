import { createZodDto } from 'nestjs-zod';
import { bitrixOAuthCallbackRequestSchema } from 'ireports-contracts';

export class BitrixOAuthCallbackDto extends createZodDto(
    bitrixOAuthCallbackRequestSchema,
) {}
