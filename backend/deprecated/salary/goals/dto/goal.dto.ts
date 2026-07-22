import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const kpiStat = z.enum([
  'REVENUE',
  'MARGIN',
  'MARGIN_MINUS_ENGINEER',
  'PCS',
  'COSTS',
]);

const managerRole = z.enum(['OFFLINE', 'ONLINE', 'BOTH']);

const createGoalSchema = z.object({
  ruleId: z.coerce.number().int().positive(),
  type: z.enum(['KPI', 'TASK']),
  direction: z.enum(['SERVICE', 'SHOP']),
  scope: z.enum(['PERSONAL', 'DEPARTMENT', 'COMPANY']).default('PERSONAL'),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  kpiDirection: z.enum(['SALES', 'TURNOVER']).optional(),
  measureStat: kpiStat.optional(),
  categoryExtId: z.string().optional(),
  managerRole: managerRole.default('OFFLINE'),
  rewardId: z.coerce.number().int().positive(),
});

const updateGoalSchema = z.object({
  scope: z.enum(['PERSONAL', 'DEPARTMENT', 'COMPANY']).optional(),
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  kpiDirection: z.enum(['SALES', 'TURNOVER']).nullable().optional(),
  measureStat: kpiStat.nullable().optional(),
  categoryExtId: z.string().nullable().optional(),
  managerRole: managerRole.optional(),
  rewardId: z.coerce.number().int().positive().optional(),
});

export class CreateGoalDto extends createZodDto(createGoalSchema) {}
export class UpdateGoalDto extends createZodDto(updateGoalSchema) {}
