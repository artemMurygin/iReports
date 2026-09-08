import { createZodDto } from 'nestjs-zod';
import { MotivationRequestSchema } from 'ireports-contracts';

export class MotivationSchemaCreateDto extends createZodDto(
    MotivationRequestSchema,
) {}
