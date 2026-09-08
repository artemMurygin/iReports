import { createZodDto } from 'nestjs-zod';
import { updateShopMotivationSchemaRequestSchema } from 'ireports-contracts';

export class UpdateShopMotivationSchemaDto extends createZodDto(
    updateShopMotivationSchemaRequestSchema,
) {}
