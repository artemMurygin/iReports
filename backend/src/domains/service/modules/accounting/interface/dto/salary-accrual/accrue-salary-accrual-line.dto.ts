import { createZodDto } from 'nestjs-zod';
import { accrueSalaryAccrualLineRequestSchema } from 'ireports-contracts';

export class AccrueSalaryAccrualLineDto extends createZodDto(
    accrueSalaryAccrualLineRequestSchema,
) {}
