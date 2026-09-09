import { z } from 'zod';

// Отчёт по оборачиваемости товара магазина — GET /v1/shop/warehouse/
// goods-turnover-report/:period (модуль warehouse, домен shop, см.
// openspec/changes/shop-turnover-report/{proposal,design,architecture}.md).
// Плоская структура: одна строка на пару «категория × склад» за месяц —
// сервер отдаёт готовое дерево категорий строит фронтенд сам (см.
// architecture.md CategoryTreeTable, shared/lib/tree.ts#buildTree) поверх
// уже существующего GET /shop/warehouse/catalog.
//
// Префикс Shop* у типов/схем — соседний контракт service-направления
// (goods-turnover-report.ts) экспортирует goodsTurnoverReportLineSchema/
// GoodsTurnoverReportResponse без префикса из того же index.ts, коллизия
// имён в barrel-экспорте иначе неизбежна.

// turnoverSum/stockSum — бэкенд отдаёт их в копейках, целым числом (см.
// Money, domains/shop/modules/warehouse/domain/value-objects/
// money.value-object.ts) — раньше комментарий здесь предполагал, что
// фронтенд сам разделит на 100 перед форматированием (по аналогии с
// salary-accrual.ts/erp-cash.ts), но ни один потребитель контракта этого не
// делал: копейки уходили прямо в formatCurrency, отчёт показывал суммы в
// 100 раз больше реальных (проверено на реальных данных — сумма из БД
// (MoySkladDemandPosition.sum, рубли) × 100 == turnoverSum ответа). Схема
// теперь сама переводит в рубли через transform — единственное место
// конвертации, а не обязанность, которую нужно не забыть на каждой
// потребляющей стороне. Не используется на бэкенде для сериализации ответа
// (контроллер отдаёт обычный TS-объект, не через .parse() этой схемы) — на
// проводе по-прежнему копейки, transform применяется только там, где кто-то
// явно вызывает .parse()/.safeParse() этой схемой (см. model/shop/api.ts на
// фронтенде).
//
// coefficient — безразмерный коэффициент (turnoverSum/avgStockSum, одна и
// та же единица в числителе и знаменателе), делить не нужно; null означает
// "коэффициент не рассчитан" (нет строки за предыдущий период для сравнения
// либо оба остатка нулевые), а не "0" — implements design.md D8 of
// shop-turnover-report.
const shopGoodsTurnoverReportLineSchema = z.object({
    categoryId: z.string(),
    warehouseId: z.string(),
    turnoverQuantity: z.number().nonnegative(),
    turnoverSum: z
        .number()
        .int()
        .nonnegative()
        .transform((kopecks) => kopecks / 100),
    stockQuantity: z.number().nonnegative(),
    stockSum: z
        .number()
        .int()
        .nonnegative()
        .transform((kopecks) => kopecks / 100),
    coefficient: z.number().nullable(),
});
export type ShopGoodsTurnoverReportLine = z.infer<
    typeof shopGoodsTurnoverReportLineSchema
>;

const shopGoodsTurnoverReportResponseSchema = z.array(
    shopGoodsTurnoverReportLineSchema,
);
export type ShopGoodsTurnoverReportResponse = z.infer<
    typeof shopGoodsTurnoverReportResponseSchema
>;

// Query-параметр опционального фильтра по складу (симметрично
// listSalesPlansQuerySchema в sales-plan.ts) — GET .../goods-turnover-
// report/:period?warehouseId=... .
const shopGoodsTurnoverReportQuerySchema = z.object({
    warehouseId: z.string().optional(),
});
export type ShopGoodsTurnoverReportQuery = z.infer<
    typeof shopGoodsTurnoverReportQuerySchema
>;

export {
    shopGoodsTurnoverReportLineSchema,
    shopGoodsTurnoverReportResponseSchema,
    shopGoodsTurnoverReportQuerySchema,
};
