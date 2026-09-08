import { createZodDto } from 'nestjs-zod';
import { listShopMotivationSchemasQuerySchema } from 'ireports-contracts';

export class ListShopMotivationSchemasQueryDto extends createZodDto(
    listShopMotivationSchemasQuerySchema,
) {}
