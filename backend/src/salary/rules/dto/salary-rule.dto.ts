import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const assignmentSchema = z
  .object({
    employeeId: z.coerce.number().int().positive().optional(),
    departmentId: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (a) => (a.employeeId != null) !== (a.departmentId != null),
    'Ровно одно из employeeId/departmentId должно быть заполнено',
  );

const createSalaryRuleSchema = z.object({
  name: z.string().min(1),
  payPerHour: z.number().int().positive().optional(),
  isRegular: z.boolean().default(false),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  assignments: z.array(assignmentSchema).default([]),
});

const updateSalaryRuleSchema = z.object({
  name: z.string().min(1).optional(),
  payPerHour: z.number().int().positive().nullable().optional(),
  isRegular: z.boolean().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});

const salaryRuleQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Период должен быть в формате YYYY-MM')
    .optional(),
});

export class CreateSalaryRuleDto extends createZodDto(createSalaryRuleSchema) {}
export class UpdateSalaryRuleDto extends createZodDto(updateSalaryRuleSchema) {}
export class SalaryRuleQueryDto extends createZodDto(salaryRuleQuerySchema) {}
