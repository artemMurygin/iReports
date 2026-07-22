import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const workScheduleQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Период должен быть в формате YYYY-MM'),
});

const shiftSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  date: z.coerce.date(),
  plannedStart: z.coerce.date().optional(),
  plannedEnd: z.coerce.date().optional(),
  plannedHours: z.number().min(0),
  actualHours: z.number().min(0).optional(),
  status: z.string().default('planned'),
  note: z.string().optional(),
});

const bulkWorkScheduleSchema = z.object({
  shifts: z.array(shiftSchema).min(1),
});

const updateWorkShiftSchema = z.object({
  plannedStart: z.coerce.date().nullable().optional(),
  plannedEnd: z.coerce.date().nullable().optional(),
  plannedHours: z.number().min(0).optional(),
  actualHours: z.number().min(0).nullable().optional(),
  status: z.string().optional(),
  note: z.string().nullable().optional(),
});

export class WorkScheduleQueryDto extends createZodDto(
  workScheduleQuerySchema,
) {}
export class BulkWorkScheduleDto extends createZodDto(bulkWorkScheduleSchema) {}
export class UpdateWorkShiftDto extends createZodDto(updateWorkShiftSchema) {}
