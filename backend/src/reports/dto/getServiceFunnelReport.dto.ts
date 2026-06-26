import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const queryNumbersArray = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => (Array.isArray(val) ? val : [val]))
  .transform((val) => val.map(Number))
  .default([]);

const queryStringsArray = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => (Array.isArray(val) ? val : [val]))
  .default([]);

const getServiceFunnelReportSchema = z.object({
  momentFrom: z.coerce.date(),
  momentTo: z.coerce.date(),
  managerIds: queryNumbersArray,
  sourceIds: queryNumbersArray,
  modelIds: queryNumbersArray,
  stageIds: queryStringsArray,
  stageGroupIds: queryStringsArray,
});

export class getServiceFunnelReportDTO extends createZodDto(
  getServiceFunnelReportSchema,
) {}
