import { createZodDto } from 'nestjs-zod';
import { listSalaryAccrualsQuerySchema } from 'ireports-contracts';

// Zod-схема запроса направление-агностична (ireports-contracts) — DTO
// переиспользует контракт, а не бизнес-код сервиса (тот же приём, что и у
// shop-task-completion-*.dto.ts).
export class ListShopSalaryAccrualsQueryDto extends createZodDto(
    listSalaryAccrualsQuerySchema,
) {}
