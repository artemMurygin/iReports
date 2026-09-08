import { createZodDto } from 'nestjs-zod';
import { ShopMotivationRequestSchema } from 'ireports-contracts';

// Зеркало domains/service/modules/accounting/interface/dto/
// motivation-schema-create.dto.ts (Фаза 13.5, issue #57) — независимая
// копия для направления shop.
export class ShopMotivationSchemaCreateDto extends createZodDto(
    ShopMotivationRequestSchema,
) {}
