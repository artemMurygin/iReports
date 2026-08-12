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
};
