import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const queryNumbersArray = z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .transform((val) => val.map(Number))
    .default([]);

const getServicesSoldReportSchema = z.object({
    momentFrom: z.coerce.date(),
    momentTo: z.coerce.date(),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
    categoryIds: queryNumbersArray,
    serviceIds: queryNumbersArray,
});

export class getServicesSoldReportDTO extends createZodDto(
    getServicesSoldReportSchema,
) {}
