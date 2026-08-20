import { createZodDto } from 'nestjs-zod';
import { updateMotivationSchemaRequestSchema } from 'ireports-contracts';

export class UpdateMotivationSchemaDto extends createZodDto(
    updateMotivationSchemaRequestSchema,
) {}
