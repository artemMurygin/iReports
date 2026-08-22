import { createZodDto } from 'nestjs-zod';
import { reverseBalanceTransactionRequestSchema } from 'ireports-contracts';

// Сторно ручного движения (Фаза 7 PRD 2): комментарий обязателен.
export class ReverseBalanceTransactionDto extends createZodDto(
    reverseBalanceTransactionRequestSchema,
) {}
