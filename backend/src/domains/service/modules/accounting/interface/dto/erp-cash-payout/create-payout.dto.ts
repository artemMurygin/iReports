import { createZodDto } from 'nestjs-zod';
import { createPayoutRequestSchema } from 'ireports-contracts';

// Выплата сотруднику направления service (PRD 3, Фаза 12): amount > 0
// проверяется схемой на границе HTTP (400), остаток/подтверждение — в
// домене (409, см. PayoutConfirmationRequiredException).
export class CreatePayoutDto extends createZodDto(createPayoutRequestSchema) {}
