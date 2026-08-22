import { createZodDto } from 'nestjs-zod';
import { createBalanceTransactionRequestSchema } from 'ireports-contracts';

// Ручное движение по балансу (Фаза 7 PRD 2): обязательность комментария
// для PENALTY/ADJUSTMENT и правила знака проверяются в самой схеме (400 на
// границе HTTP) и продублированы в домене.
export class CreateBalanceTransactionDto extends createZodDto(
    createBalanceTransactionRequestSchema,
) {}
