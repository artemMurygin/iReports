import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createSalaryAdjustmentSchema = z
  .object({
    employeeId: z.coerce.number().int().positive(),
    period: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Период должен быть в формате YYYY-MM'),
    accrualType: z.enum(['PENALTY', 'ADJUSTMENT']),
    amount: z.number().int(),
    reason: z.string().min(1),
    createdById: z.coerce.number().int().positive(),
  })
  .refine((dto) => dto.accrualType !== 'PENALTY' || dto.amount < 0, {
    message:
      'Штраф (PENALTY) должен уменьшать ЗП — amount должен быть отрицательным',
    path: ['amount'],
  });

const salaryAdjustmentQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Период должен быть в формате YYYY-MM'),
});

export class CreateSalaryAdjustmentDto extends createZodDto(
  createSalaryAdjustmentSchema,
) {}
export class SalaryAdjustmentQueryDto extends createZodDto(
  salaryAdjustmentQuerySchema,
) {}
