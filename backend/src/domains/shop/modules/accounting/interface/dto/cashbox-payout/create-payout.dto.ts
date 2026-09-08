import { createZodDto } from 'nestjs-zod';
import { createPayoutRequestSchema } from 'ireports-contracts';

// Выплата сотруднику направления shop (PRD 3, Фаза 12): amount > 0
// проверяется схемой на границе HTTP (400), остаток/подтверждение — в
// домене (409, см. PayoutConfirmationRequiredException). Схема — общая
// contracts-форма запроса, как и у направления service (одинаковое тело,
// разные пути /v1/service.../payout и /v1/shop.../payout).
export class CreateShopPayoutDto extends createZodDto(
    createPayoutRequestSchema,
) {}
