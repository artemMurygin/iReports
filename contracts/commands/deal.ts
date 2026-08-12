import { z } from 'zod';

// Список сделок Bitrix24 (bitrix_deals) за диапазон дат создания — контракт
// для нового эндпоинта `GET /v1/service/sales/deals` (см.
// docs/todo-modules-ddd-refactoring), заменяющего постепенно
// `GET /deals` из src/TODO/deals. Формы схем скопированы с РЕАЛЬНОГО
// текущего ответа старого контроллера (DealsService.getDeals — Prisma
// include: stage, assignedBy, pointOfContact, leadSource, brand,
// deviceType), а не с фронтенд-типов kernel/types.ts: те местами не
// совпадают со фактической формой связанных Prisma-моделей (bitrix.prisma)
// — см. подробности по каждому полю ниже. Задача этой фазы — не менять
// поведение для фронтенда, поэтому расхождения зафиксированы намеренно, а
// не "исправлены" в контракте.
//
// Поле `source` (ApiSource) из фронтенд-типа Deal сюда сознательно не
// включено: `DealsController.getDeals` никогда не выбирает Prisma-связь с
// таким именем (include содержит только stage/assignedBy/pointOfContact/
// leadSource/brand/deviceType), и по всему frontend/src не нашлось ни
// одного места, которое читает `deal.source` — это неиспользуемое поле в
// устаревшей типизации, а не отражение реальных данных.

// ========================== Вложенные объекты ========================== //

// BitrixStage (bitrix.prisma) — те же поля, что реально отдаёт
// `include: { stage: true }`, кроме entityId (внутренний технический
// признак "это стадия сделки", не нужен потребителю списка сделок).
// stageId на BitrixDeal — необязательный FK (String?), поэтому сама стадия
// нужна как nullable, даже если фронтенд сейчас типизирует Deal.stage как
// обязательное поле (ApiStage без `| null`) — контракт описывает реальную,
// а не предполагаемую форму данных.
const dealListStageSchema = z.object({
    id: z.string(),
    name: z.string(),
    sort: z.number(),
    color: z.string(),
    systemType: z.string(),
    stageGroupId: z.string().nullable(),
    stageGroupName: z.string().nullable(),
});
export type DealListStage = z.infer<typeof dealListStageSchema>;

// BitrixEmployee (bitrix.prisma) — `include: { assignedBy: true }` реально
// возвращает больше полей (departmentId, roappId, moySkladId,
// roappOnlineName), но потребителю списка сделок нужны только эти три —
// совпадает с ApiEmployee на фронтенде.
const dealAssigneeSchema = z.object({
    id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
});
export type DealAssignee = z.infer<typeof dealAssigneeSchema>;

// BitrixPointOfContact (bitrix.prisma) — полностью совпадает с моделью
// (id, name, sort) и с ApiPointOfContact на фронтенде.
const dealPointOfContactSchema = z.object({
    id: z.string(),
    name: z.string(),
    sort: z.number(),
});
export type DealPointOfContact = z.infer<typeof dealPointOfContactSchema>;

// BitrixLeadSources (bitrix.prisma) — модель, на которую реально
// резолвится Prisma-связь `leadSource` у BitrixDeal. У неё только id и
// name — поля `sort`/`value`/`fieldName`, которые фронтенд ожидает от
// Deal.leadSource через тип ApiEnumValue, в реальном ответе backend
// отсутствуют (см. также dealBrandSchema — там как раз ApiEnumValue-подобная
// форма, но у другой Prisma-модели).
const dealLeadSourceSchema = z.object({
    id: z.number(),
    name: z.string(),
});
export type DealLeadSource = z.infer<typeof dealLeadSourceSchema>;

// BitrixEnumValue (bitrix.prisma), связь "DealBrand" — id/fieldName/value/
// sort, реальная форма, на которую резолвится `brand`.
const dealBrandSchema = z.object({
    id: z.number(),
    fieldName: z.string(),
    value: z.string(),
    sort: z.number(),
});
export type DealBrand = z.infer<typeof dealBrandSchema>;

// BitrixDeviceTypes (bitrix.prisma) — только id и name, реальная форма,
// на которую резолвится `deviceType`.
const dealDeviceTypeSchema = z.object({
    id: z.number(),
    name: z.string(),
});
export type DealDeviceType = z.infer<typeof dealDeviceTypeSchema>;

// ========================== Элемент списка ========================== //

const dealListItemSchema = z.object({
    id: z.number(),
    title: z.string().nullable(),
    opportunity: z.number().nullable(),
    categoryId: z.number(),
    deviceModel: z.string().nullable(),
    deviceMalfunction: z.string().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date().nullable(),
    stage: dealListStageSchema.nullable(),
    assignedBy: dealAssigneeSchema.nullable(),
    pointOfContact: dealPointOfContactSchema.nullable(),
    leadSource: dealLeadSourceSchema.nullable(),
    brand: dealBrandSchema.nullable(),
    deviceType: dealDeviceTypeSchema.nullable(),
});
export type DealListItem = z.infer<typeof dealListItemSchema>;

// ========================== Запрос/ответ эндпоинта ========================== //

// from/to — обе строки обязательны и непустые; реальная валидация формата
// даты (ISO 8601) и порядка границ — ответственность доменного
// DateRange VO (src/shared/domain/date-range.value-object.ts), не этой
// DTO-схемы. z.coerce.date() здесь намеренно не используется — ломает
// генерацию OpenAPI для query-параметров (см. backend/CLAUDE.md).
const listDealsQuerySchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
});
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;

const listDealsResponseSchema = z.object({
    total: z.number(),
    deals: z.array(dealListItemSchema),
});
export type ListDealsResponse = z.infer<typeof listDealsResponseSchema>;

// ==================== Отчёт по воронке сервисных сделок ==================== //
//
// Контракт для `GET /v1/service/sales/funnel-report` (Фаза 4,
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// новый дом для `GET /reports/service-funnel` из src/TODO/reports
// (getServiceFunnelReportDTO). Форма ответа (`{ KPI, deals }`) и набор
// фильтров скопированы с РЕАЛЬНОГО легаси-эндпоинта (ReportsService.
// getServiceFunnelReport + serviceFunnelKPICalculation), `deals` — та же
// dealListItemSchema, что и у списка сделок выше (Prisma include там
// идентичен: stage/assignedBy/pointOfContact/leadSource/brand/deviceType).
//
// Легаси-DTO валидировал даты через `z.coerce.date()` — это ломает
// генерацию OpenAPI-схемы (zod v4 toJSONSchema() не умеет сериализовать
// Date, см. swagger.config.ts), поэтому здесь, как и у listDealsQuerySchema,
// даты — обычные ISO-строки, реальная валидация — доменный DateRange VO.

// Query-параметры множественного выбора (managerIds/sourceIds/modelIds/
// stageIds/stageGroupIds) приходят через Express как строка (один элемент)
// либо массив строк (несколько) — тот же приём, что и в легаси
// queryNumbersArray/queryStringsArray (src/TODO/reports/dto/
// getServiceFunnelReport.dto.ts), перенесённый как есть: input-схема
// (string | string[]) — валидный JSON Schema, поэтому OpenAPI не ломается
// (в отличие от z.coerce.date() выше).
const queryNumberArray = z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .transform((val) => val.map(Number))
    .default([]);

const queryStringArray = z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .default([]);

const getServiceFunnelReportQuerySchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    managerIds: queryNumberArray,
    sourceIds: queryNumberArray,
    modelIds: queryNumberArray,
    stageIds: queryStringArray,
    stageGroupIds: queryStringArray,
});
export type GetServiceFunnelReportQuery = z.infer<
    typeof getServiceFunnelReportQuerySchema
>;

// Счётчики групп воронки + конверсии — форма 1:1 с возвратом легаси
// serviceFunnelKPICalculation (src/TODO/reports/reports.helpers.ts).
const serviceFunnelKpiSchema = z.object({
    allLeads: z.number(),
    nonTargetDeals: z.number(),
    targetedLeads: z.number(),
    won: z.number(),
    lose: z.number(),
    inWork: z.number(),
    waitingInService: z.number(),
    inService: z.number(),
    conversionRate: z.number(),
    avgDeal: z.number(),
    revenue: z.number(),
});
export type ServiceFunnelKpiResponse = z.infer<typeof serviceFunnelKpiSchema>;

// Ключ ответа `KPI` (не `kpi`) — сохранён как в легаси ради паритета формы
// ответа для фронтенда на время миграции (см. "В скоупе" PRD: "функциональность
// для пользователя не меняется").
const getServiceFunnelReportResponseSchema = z.object({
    KPI: serviceFunnelKpiSchema,
    deals: z.array(dealListItemSchema),
});
export type GetServiceFunnelReportResponse = z.infer<
    typeof getServiceFunnelReportResponseSchema
>;

export {
    dealListStageSchema,
    dealAssigneeSchema,
    dealPointOfContactSchema,
    dealLeadSourceSchema,
    dealBrandSchema,
    dealDeviceTypeSchema,
    dealListItemSchema,
    listDealsQuerySchema,
    listDealsResponseSchema,
    serviceFunnelKpiSchema,
    getServiceFunnelReportQuerySchema,
    getServiceFunnelReportResponseSchema,
};
