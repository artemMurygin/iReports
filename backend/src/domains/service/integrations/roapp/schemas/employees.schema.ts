import { z } from 'zod';

export const EmployeesSchema = z.object({
  id: z.number().int().positive(),
  created_at: z.coerce.date(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string(),
  email: z.string(),
  position: z.string(),
  hire_date: z.coerce.date(),
  notes: z.string(),
  is_active: z.boolean(),
  login: z.string(),
  avatar: z.string(),
});

export const EmployeesShortSchema = EmployeesSchema.pick({
  id: true,
  first_name: true,
  last_name: true,
});
