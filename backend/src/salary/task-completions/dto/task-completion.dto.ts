import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createTaskCompletionSchema = z.object({
  goalId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive(),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Период должен быть в формате YYYY-MM'),
});

const updateTaskCompletionSchema = z.object({
  completed: z.boolean(),
  approvedById: z.coerce.number().int().positive().optional(),
});

export class CreateTaskCompletionDto extends createZodDto(
  createTaskCompletionSchema,
) {}
export class UpdateTaskCompletionDto extends createZodDto(
  updateTaskCompletionSchema,
) {}
