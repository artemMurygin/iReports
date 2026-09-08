import { createZodDto } from 'nestjs-zod';
import { reopenAccountingPeriodRequestSchema } from 'ireports-contracts';

export class ReopenAccountingPeriodDto extends createZodDto(
    reopenAccountingPeriodRequestSchema,
) {}
