import { createZodDto } from 'nestjs-zod';
import { listSalaryAccrualsQuerySchema } from 'ireports-contracts';

export class ListSalaryAccrualsQueryDto extends createZodDto(
    listSalaryAccrualsQuerySchema,
) {}
