import { createZodDto } from 'nestjs-zod';
import { balanceSummaryQuerySchema } from 'ireports-contracts';

// departmentId — необязательный фильтр (без него сотрудники всех отделов),
// search — регистронезависимая подстрока по «Имя Фамилия».
export class GetBalanceSummaryQueryDto extends createZodDto(
    balanceSummaryQuerySchema,
) {}
