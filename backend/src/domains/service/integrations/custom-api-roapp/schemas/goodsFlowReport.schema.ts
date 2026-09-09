import { z } from 'zod';

export const GoodsFlowReportRequestSchema = z.object({
    startDate: z.number(),
    endDate: z.number(),
    category_id: z.number(),
    warehouses: z.array(z.number()),
});

export type GoodsFlowReportRequest = z.infer<
    typeof GoodsFlowReportRequestSchema
>;

const GoodsFlowMetricSchema = z.object({
    quantity: z.number(),
    sum: z.number(),
});

export const GoodsFlowReportResponseSchema = z.object({
    outcome: GoodsFlowMetricSchema,
    stock: GoodsFlowMetricSchema,
});

export type GoodsFlowReportResponse = z.infer<
    typeof GoodsFlowReportResponseSchema
>;
