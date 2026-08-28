import { createZodDto } from 'nestjs-zod';
import { adjustSalaryAccrualLineRequestSchema } from 'ireports-contracts';

// Zod-схема запроса направление-агностична (ireports-contracts) — DTO
// переиспользует контракт, а не бизнес-код сервиса (тот же приём, что и у
// list-shop-salary-accruals-query.dto.ts).
export class AdjustShopSalaryAccrualLineDto extends createZodDto(
    adjustSalaryAccrualLineRequestSchema,
) {}
