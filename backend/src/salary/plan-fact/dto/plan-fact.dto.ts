import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const kpiStat = z.enum([
  'REVENUE',
  'MARGIN',
  'MARGIN_MINUS_ENGINEER',
  'PCS',
  'COSTS',
]);
const direction = z.enum(['SERVICE', 'SHOP']);
const scope = z.enum(['PERSONAL', 'DEPARTMENT', 'COMPANY']);
const period = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Период должен быть в формате YYYY-MM');

const planFactQuerySchema = z.object({ period, direction: direction.optional(), scope });

const planTargetItemSchema = z.object({
  period,
  direction,
  scope,
  employeeId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  categoryExtId: z.string().optional(),
  stat: kpiStat,
  planValue: z.number().int(),
});

const bulkPlanTargetsSchema = z.object({
  items: z.array(planTargetItemSchema).min(1),
});
const updatePlanTargetSchema = z.object({
  direction: direction.optional(),
  scope: scope.optional(),
  employeeId: z.coerce.number().int().positive().nullable().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  categoryExtId: z.string().nullable().optional(),
  stat: kpiStat.optional(),
  planValue: z.number().int().optional(),
});

export class PlanFactQueryDto extends createZodDto(planFactQuerySchema) {}
export class BulkCreatePlanTargetsDto extends createZodDto(
  bulkPlanTargetsSchema,
) {}
export class UpdatePlanTargetDto extends createZodDto(updatePlanTargetSchema) {}
