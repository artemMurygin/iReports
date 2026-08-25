import { z } from 'zod';

// Аналитика проданных услуг и справочник категорий услуг — контракты для
// `GET /v1/service/reports/services` и `GET /v1/service/reports/service-categories`
// (Фаза 5, docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// новый дом для `GET /reports/services-analytics` и `GET /reports/service-categories`
// из src/TODO/reports (getServicesSoldReportDTO, ReportsService.getServiceCategories),
// который эта же фаза удаляет целиком. Формы схем скопированы с РЕАЛЬНОГО легаси-ответа
// (ReportsService.getServicesAnalytics/getServiceCategories), не с фронтенд-типов.
//
// Как и у getServiceFunnelReportQuerySchema (contracts/commands/deal.ts) — легаси-DTO
// валидировал даты через `z.coerce.date()`, что ломает генерацию OpenAPI-схемы (zod v4
// toJSONSchema() не сериализует Date), поэтому здесь даты — ISO-строки, реальная
// валидация — доменный DateRange VO (src/shared/domain/date-range.value-object.ts).

// ==================== Категории услуг ==================== //

// RoappServiceCategory (roapp.prisma) — плоский список (не дерево, в отличие от
// CatalogCategoryResponse каталога магазина), ровно те поля, что реально выбирает
// легаси ReportsService.getServiceCategories (select: id/name/parentId/depth).
const serviceCategorySchema = z.object({
    id: z.number(),
    name: z.string(),
    parentId: z.number().nullable(),
    depth: z.number(),
});
export type ServiceCategoryResponse = z.infer<typeof serviceCategorySchema>;

const listServiceCategoriesResponseSchema = z.array(serviceCategorySchema);
export type ListServiceCategoriesResponse = z.infer<
    typeof listServiceCategoriesResponseSchema
>;

// ==================== Типы заказов ==================== //

// RoappOrderType (roapp.prisma, roapp_order_types) — плоский справочник типов
// заказов RoApp (Фаза 1, docs/service-plan-salary-rule-order-category-filter/
// plan-service-plan-salary-rule-order-category-filter.md), для
// GET /v1/service/reports/order-type. По форме — тот же паттерн, что и
// serviceCategorySchema выше, но без parentId/depth: RoappOrderType — плоская
// таблица id/name без иерархии.
const orderTypeSchema = z.object({
    id: z.number(),
    name: z.string(),
});
export type OrderTypeResponse = z.infer<typeof orderTypeSchema>;

const listOrderTypesResponseSchema = z.array(orderTypeSchema);
export type ListOrderTypesResponse = z.infer<
    typeof listOrderTypesResponseSchema
>;

// ==================== Аналитика проданных услуг ==================== //

// Query-параметры множественного выбора (categoryIds/serviceIds) — тот же приём, что
// queryNumbersArray в легаси getServicesSoldReportDTO (src/TODO/reports/dto/
// getServicesSoldReport.dto.ts) и queryNumberArray в deal.ts.
const queryNumberArray = z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .transform((val) => val.map(Number))
    .default([]);

const getServicesAnalyticsQuerySchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
    categoryIds: queryNumberArray,
    serviceIds: queryNumberArray,
});
export type GetServicesAnalyticsQuery = z.infer<
    typeof getServicesAnalyticsQuerySchema
>;

// Одна точка разбивки по периодам — форма 1:1 с buildPeriodBreakdown
// (src/TODO/reports/reports.service.ts): count — сумма quantity в бакете, avgPrice —
// средневзвешенная (по quantity) цена, 0 для пустого бакета.
const periodBreakdownEntrySchema = z.object({
    period: z.string(),
    count: z.number(),
    avgPrice: z.number(),
});
export type PeriodBreakdownEntryResponse = z.infer<
    typeof periodBreakdownEntrySchema
>;

// Метрики одной услуги — форма 1:1 с возвратом легаси calcServiceMetrics
// (avgOrderCheck считается по уникальным заказам, а не по строкам услуг — та же
// дедупликация, что и в легаси, инкапсулирована в доменной VO ServiceMetrics).
const serviceAnalyticsItemSchema = z.object({
    serviceId: z.number(),
    serviceName: z.string(),
    categoryId: z.number().nullable(),
    totalCount: z.number(),
    totalRevenue: z.number(),
    totalProfit: z.number(),
    totalEngineerBonus: z.number(),
    avgServicePrice: z.number(),
    avgOrderCheck: z.number(),
    breakdown: z.array(periodBreakdownEntrySchema),
});
export type ServiceAnalyticsItemResponse = z.infer<
    typeof serviceAnalyticsItemSchema
>;

const getServicesAnalyticsResponseSchema = z.object({
    services: z.array(serviceAnalyticsItemSchema),
});
export type GetServicesAnalyticsResponse = z.infer<
    typeof getServicesAnalyticsResponseSchema
>;

export {
    serviceCategorySchema,
    listServiceCategoriesResponseSchema,
    orderTypeSchema,
    listOrderTypesResponseSchema,
    getServicesAnalyticsQuerySchema,
    periodBreakdownEntrySchema,
    serviceAnalyticsItemSchema,
    getServicesAnalyticsResponseSchema,
};
