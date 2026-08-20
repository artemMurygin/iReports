import { createZodDto } from 'nestjs-zod';
import { listMotivationSchemasQuerySchema } from 'ireports-contracts';

export class ListMotivationSchemasQueryDto extends createZodDto(
    listMotivationSchemasQuerySchema,
) {}
