import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ── Направления ────────────────────────────────────────────────────────────
export class CreateDirectionDto extends createZodDto(
  z.object({ name: z.string().min(1) }),
) {}

// ── Цели ──────────────────────────────────────────────────────────────────
export class CreateTargetDto extends createZodDto(
  z.object({
    directionId: z.number().int().positive(),
    metric: z.enum(['revenue', 'margin']).default('revenue'),
    moySkladFolderId: z.string().optional(),
    roappServiceCategoryId: z.number().int().positive().optional(),
    roappProductCategoryId: z.number().int().positive().optional(),
  }),
) {}

export class UpdateTargetDto extends createZodDto(
  z.object({
    metric: z.enum(['revenue', 'margin']).optional(),
    moySkladFolderId: z.string().nullable().optional(),
    roappServiceCategoryId: z.number().int().positive().nullable().optional(),
    roappProductCategoryId: z.number().int().positive().nullable().optional(),
  }),
) {}

// ── Шкалы коэффициентов ────────────────────────────────────────────────────
export class CreateScaleDto extends createZodDto(
  z.object({ name: z.string().min(1) }),
) {}

export class CreatePointDto extends createZodDto(
  z.object({
    fulfillmentPct: z.number().positive(),
    coefficient: z.number().positive(),
  }),
) {}

export class UpdatePointDto extends createZodDto(
  z.object({
    fulfillmentPct: z.number().positive().optional(),
    coefficient: z.number().positive().optional(),
  }),
) {}

// ── Правила мотивации ──────────────────────────────────────────────────────
export class CreateMotivationRuleDto extends createZodDto(
  z.object({
    name: z.string().min(1),
    directionId: z.number().int().positive(),
    scaleId: z.number().int().positive(),
    payoutBase: z.enum(['revenue', 'margin']).default('margin'),
    effectiveFrom: z.coerce.date().optional(),
  }),
) {}

export class UpdateMotivationRuleDto extends createZodDto(
  z.object({
    name: z.string().min(1).optional(),
    scaleId: z.number().int().positive().optional(),
    payoutBase: z.enum(['revenue', 'margin']).optional(),
    effectiveFrom: z.coerce.date().nullable().optional(),
  }),
) {}

// ── Строки правила ─────────────────────────────────────────────────────────
export class CreateRuleItemDto extends createZodDto(
  z.object({
    targetId: z.number().int().positive(),
    basePercent: z.number().positive(),
  }),
) {}

export class UpdateRuleItemDto extends createZodDto(
  z.object({ basePercent: z.number().positive() }),
) {}

// ── План / Факт ────────────────────────────────────────────────────────────
const planFactBase = z.object({
  targetId: z.number().int().positive(),
  period: z.coerce.date(),
  value: z.number(),
});

export class CreatePlanDto extends createZodDto(planFactBase) {}
export class UpdatePlanDto extends createZodDto(
  z.object({ value: z.number() }),
) {}

export class CreateFactDto extends createZodDto(
  planFactBase.extend({
    source: z.enum(['moy_sklad', 'roapp', 'manual']).default('manual'),
  }),
) {}
export class UpdateFactDto extends createZodDto(
  z.object({
    value: z.number().optional(),
    source: z.enum(['moy_sklad', 'roapp', 'manual']).optional(),
  }),
) {}

// ── Привязка сотрудников ───────────────────────────────────────────────────
export class CreateEmployeeRuleDto extends createZodDto(
  z.object({
    ruleId: z.number().int().positive(),
    bitrixEmployeeId: z.number().int().positive().optional(),
    bitrixDepartmentId: z.number().int().positive().optional(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional(),
  }),
) {}

// ── Фильтры ────────────────────────────────────────────────────────────────
export class MotivationQueryDto extends createZodDto(
  z.object({
    period: z.coerce.date(),
    ruleId: z.coerce.number().int().positive().optional(),
  }),
) {}

export class PeriodQueryDto extends createZodDto(
  z.object({ period: z.coerce.date() }),
) {}
