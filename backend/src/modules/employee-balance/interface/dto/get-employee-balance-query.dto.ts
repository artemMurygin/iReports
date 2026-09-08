import { createZodDto } from 'nestjs-zod';
import { getEmployeeBalanceQuerySchema } from 'ireports-contracts';

// from/to — диапазон по дате движения (occurredAt), types — список типов
// через запятую (?types=SALARY_ACCRUAL,ADVANCE) — парсинг в самой схеме.
export class GetEmployeeBalanceQueryDto extends createZodDto(
    getEmployeeBalanceQuerySchema,
) {}
