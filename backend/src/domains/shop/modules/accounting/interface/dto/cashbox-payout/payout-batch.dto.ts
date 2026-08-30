import { createZodDto } from 'nestjs-zod';
import { payoutBatchRequestSchema } from 'ireports-contracts';

// Массовая выплата направления shop (PRD 3, Фаза 12): amount не
// передаётся — сервер берёт остаток каждого сотрудника на момент операции.
export class ShopPayoutBatchDto extends createZodDto(
    payoutBatchRequestSchema,
) {}
