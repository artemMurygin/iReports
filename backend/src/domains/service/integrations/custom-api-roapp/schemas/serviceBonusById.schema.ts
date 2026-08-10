import { z } from 'zod';

function getWarrantyLabel(unit: number) {
    if (unit === 0) return ' дней';
    if (unit === 1) return ' месяцев';
    return ' год';
}

function getWarrantyUnitAbbrev(unit: number) {
    if (unit === 0) return 'дн.';
    if (unit === 1) return 'мес.';
    return 'г.';
}

export const ServiceBonusByIdSchema = z
    .object({
        id: z.number(),
        title: z.string(),
        uom_id: z.number(),
        category_id: z.number(),
        cost: z.number(),
        type: z.number(),
        prices: z.record(z.string(), z.number()),
        duration_hours: z.number(),
        barcodes: z.array(z.string()),
        description: z.string(),
        employee_selection: z.number(),
        warranty: z.number(),
        warranty_period: z.number(),
        earnings_sum: z.number(),
    })
    .transform((d) => ({
        id: d.id,
        name: d.title,
        uomId: d.uom_id,
        categoryId: d.category_id,
        cost: d.cost,
        type: d.type,
        price: d.prices['543835'] ?? 0,
        durationHours: d.duration_hours,
        barcodes: d.barcodes,
        description: d.description,
        employeeSelection: d.employee_selection,
        warranty: d.warranty + getWarrantyLabel(d.warranty_period),
        warrantyPeriod: d.warranty,
        warrantyUnit: getWarrantyUnitAbbrev(d.warranty_period),
        bonus: d.earnings_sum,
    }));

export type ServiceBonusById = z.infer<typeof ServiceBonusByIdSchema>;
