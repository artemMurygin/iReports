import { z } from 'zod';

function getPeriod(unit: 'days' | 'months' | 'years') {
  if (unit === 'days') return ' дней';
  if (unit === 'months') return ' месяцев';
  else return ' год';
}

function getPeriodAbbrev(unit: 'days' | 'months' | 'years') {
  if (unit === 'days') return 'дн.';
  if (unit === 'months') return 'мес.';
  else return 'г.';
}

const warrantySchema = z.object({
  period: z.number().int(),
  unit: z.enum(['days', 'months', 'years']),
});

export const ServiceSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string(),
    description: z.string(),
    type: z.enum(['service', 'product']),
    uom_id: z.number().int(),
    category_id: z.number().int(),
    cost: z.string(), // "0.00"
    prices: z.record(
      z.string(),
      z.string().transform((v) => Math.round(parseFloat(v))),
    ),
    duration: z.number().int(),
    barcodes: z.array(z.string()),
    warranty: warrantySchema,
  })
  .transform((d) => ({
    id: d.id,
    categoryId: d.category_id,
    name: d.title,
    price: d.prices['543835'] ?? 0,
    warranty: d.warranty.period + getPeriod(d.warranty.unit),
    warrantyPeriod: d.warranty.period,
    warrantyUnit: getPeriodAbbrev(d.warranty.unit),
    duration: d.duration,
  }));

export type Service = z.infer<typeof ServiceSchema>;
