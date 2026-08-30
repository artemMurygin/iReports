import { createZodDto } from 'nestjs-zod';
import { reopenAccountingPeriodRequestSchema } from 'ireports-contracts';

// Zod-схема запроса направление-агностична (ireports-contracts) — DTO
// переиспользует контракт, а не бизнес-код сервиса (тот же приём, что и у
// list-salary-accruals-query.dto.ts).
export class ReopenShopAccountingPeriodDto extends createZodDto(
    reopenAccountingPeriodRequestSchema,
) {}
