import { createZodDto } from 'nestjs-zod';
import { closeAccountingPeriodRequestSchema } from 'ireports-contracts';

export class CloseAccountingPeriodDto extends createZodDto(
    closeAccountingPeriodRequestSchema,
) {}
