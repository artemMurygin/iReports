import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const kpiStat = z.enum([
  'REVENUE',
  'MARGIN',
  'MARGIN_MINUS_ENGINEER',
  'PCS',
  'COSTS',
]);

const tierSchema = z.object({
  fromPct: z.number().int(),
  toPct: z.number().int().nullable(),
  mode: z.enum(['FIXED', 'LINEAR', 'MULTIPLIER']),
  coef: z.number().nullable().optional(),
  coefFrom: z.number().nullable().optional(),
  coefTo: z.number().nullable().optional(),
});

const createRewardSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PERCENT', 'FIX']),
  value: z.number().int(),
  baseStat: kpiStat.optional(),
  categoryExtId: z.string().optional(),
  minAmount: z.number().int().optional(),
  maxAmount: z.number().int().optional(),
  tiers: z.array(tierSchema).default([]),
});

const updateRewardSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['PERCENT', 'FIX']).optional(),
  value: z.number().int().optional(),
  baseStat: kpiStat.nullable().optional(),
  categoryExtId: z.string().nullable().optional(),
  minAmount: z.number().int().nullable().optional(),
  maxAmount: z.number().int().nullable().optional(),
  // Если передан — полностью заменяет текущий набор тиров (проще и предсказуемее, чем diff).
  tiers: z.array(tierSchema).optional(),
});

export class CreateRewardDto extends createZodDto(createRewardSchema) {}
export class UpdateRewardDto extends createZodDto(updateRewardSchema) {}
