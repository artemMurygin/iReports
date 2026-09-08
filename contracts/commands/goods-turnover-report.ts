import { z } from 'zod';

// Отчёт по оборачиваемости товара магазина — GET /v1/shop/warehouse/
// goods-turnover-report/:period (модуль warehouse, домен shop, см.
// openspec/changes/shop-turnover-report/{proposal,design,architecture}.md).
// Плоская структура: одна строка на пару «категория × склад» за месяц —
// сервер отдаёт готовое дерево категорий строит фронтенд сам (см.
// architecture.md CategoryTreeTable, shared/lib/tree.ts#buildTree) поверх
// уже существующего GET /shop/warehouse/catalog.

// turnoverSum/stockSum — в копейках (см. Money,
// domains/shop/modules/warehouse/domain/value-objects/money.value-object.ts),
// фронтенд форматирует их сам — тот же паттерн, что и в salary-accrual.ts/
// erp-cash.ts (amount: z.number().int()).
//
// coefficient: null означает "коэффициент не рассчитан" (нет строки за
// предыдущий период для сравнения либо оба остатка нулевые), а не "0" —
// implements design.md D8 of shop-turnover-report.
const goodsTurnoverReportLineSchema = z.object({
    categoryId: z.string(),
    warehouseId: z.string(),
    turnoverQuantity: z.number().nonnegative(),
    turnoverSum: z.number().int().nonnegative(),
    stockQuantity: z.number().nonnegative(),
    stockSum: z.number().int().nonnegative(),
    coefficient: z.number().nullable(),
});
export type GoodsTurnoverReportLine = z.infer<
    typeof goodsTurnoverReportLineSchema
>;

const goodsTurnoverReportResponseSchema = z.array(
    goodsTurnoverReportLineSchema,
);
export type GoodsTurnoverReportResponse = z.infer<
    typeof goodsTurnoverReportResponseSchema
>;

export { goodsTurnoverReportLineSchema, goodsTurnoverReportResponseSchema };
