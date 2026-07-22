import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const salaryReportParamsSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Период должен быть в формате YYYY-MM'),
});

export class SalaryReportParamsDto extends createZodDto(
  salaryReportParamsSchema,
) {}
