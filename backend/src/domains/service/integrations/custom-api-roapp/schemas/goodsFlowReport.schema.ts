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

// sum приходит от RoApp дробным числом (с копейками) — round до целых
// рублей здесь же, в контракте, той же формулой, что и
// domains/service/modules/accounting/domain/services/money.ts#roundRubles,
// чтобы GoodsFlowMetric (требует целую сумму, см. money.ts) не отбрасывал
// пару категория-склад целиком из-за ArgumentInvalidException.
//
// quantity иногда приходит от RoApp отрицательным (например -1) для
// отдельных пар категория-склад — по той же причине, что и sum выше,
// клэмпим в 0 здесь же, а не даём GoodsFlowMetric.create отбросить всю
// пару из-за ArgumentInvalidException.
const GoodsFlowMetricSchema = z.object({
    quantity: z.number().transform((quantity) => Math.max(0, quantity)),
    sum: z.number().transform((sum) => Math.round(sum)),
});

export const GoodsFlowReportResponseSchema = z.object({
    outcome: GoodsFlowMetricSchema,
    stock: GoodsFlowMetricSchema,
});

export type GoodsFlowReportResponse = z.infer<
    typeof GoodsFlowReportResponseSchema
>;
