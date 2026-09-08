import { createZodDto } from 'nestjs-zod';
import { adjustSalaryAccrualLineRequestSchema } from 'ireports-contracts';

export class AdjustSalaryAccrualLineDto extends createZodDto(
    adjustSalaryAccrualLineRequestSchema,
) {}
