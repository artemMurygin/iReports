import { z } from 'zod';
import {
    shopSalaryRuleRequestSchema,
    shopSalaryRuleResponseSchema,
} from './shop-salary-rule';

// Контракт мотивации магазина (Фаза 13.5) — по прямой аналогии с
// shop-salary-rule.ts: отдельный от сервисного MotivationRequestSchema
// (contracts/commands/motivation-schema.ts) объект, а не расширение его
// `rules` до union обоих направлений — тот файл уже зафиксировал этот же
// принцип для набора типов правил (issue #57: направления технически не
// связаны одним объектом). `rules` здесь — shopSalaryRuleRequestSchema[],
// а не salaryRuleRequestSchema[] сервиса.
const ShopMotivationRequestSchema = z.object({
    targetType: z.enum(['Department', 'Employee']),
    targetId: z.number(),
    name: z.string(),
    rules: z.array(shopSalaryRuleRequestSchema),
});

export type ShopMotivationRequest = z.infer<typeof ShopMotivationRequestSchema>;
export type ShopMotivationResponse = {
    id: string;
};

// ========================== Просмотр/редактирование схем (страница списка/деталей) ========================== //

// Цель схемы, отдаваемая наружу с уже резолвленным именем (справочник
// Bitrix, см. modules/directory) — фронту не нужно делать отдельный запрос
// к справочнику, чтобы показать "Отдел: Продажи" / "Сотрудник: Иванов И.И."
// в карточке. Зеркало одноимённой schema сервиса
// (contracts/commands/motivation-schema.ts) — независимый объект (issue
// #57), а не общий на оба направления.
const shopMotivationSchemaTargetSchema = z.object({
    type: z.enum(['Department', 'Employee']),
    id: z.number(),
    name: z.string(),
});

export type ShopMotivationSchemaTarget = z.infer<
    typeof shopMotivationSchemaTargetSchema
>;

// Элемент списка GET /v1/shop/accounting/motivation-schema — без самих
// правил (только сводка: количество и уникальные типы, в порядке первого
// появления), полный набор правил отдаётся только GET по :id (детальная
// карточка/форма редактирования). direction — литерал 'shop', а не
// вычисляемое на фронте поле: он же определяет, какая пара GET/PATCH
// эндпоинтов обслуживает эту карточку.
const shopMotivationSchemaListItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    direction: z.literal('shop'),
    target: shopMotivationSchemaTargetSchema,
    ruleCount: z.number(),
    ruleTypes: z.array(z.string()),
    updatedAt: z.coerce.date(),
});

export type ShopMotivationSchemaListItem = z.infer<
    typeof shopMotivationSchemaListItemSchema
>;

// Query-фильтры GET /v1/shop/accounting/motivation-schema — все
// необязательные, без пагинации/сортировки (сортирует фронт, см.
// docs/salary-schema-creation-ui: объём справочника мал).
const listShopMotivationSchemasQuerySchema = z.object({
    targetType: z.enum(['Department', 'Employee']).optional(),
    targetId: z.coerce.number().optional(),
    search: z.string().optional(),
});

export type ListShopMotivationSchemasQuery = z.infer<
    typeof listShopMotivationSchemasQuerySchema
>;

const listShopMotivationSchemasResponseSchema = z.array(
    shopMotivationSchemaListItemSchema,
);

export type ListShopMotivationSchemasResponse = z.infer<
    typeof listShopMotivationSchemasResponseSchema
>;

// GET /v1/shop/accounting/motivation-schema/:id — полная схема со всеми
// правилами (id+type+name+targetRole+config каждого) для предзаполнения
// формы редактирования.
const shopMotivationSchemaDetailResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    direction: z.literal('shop'),
    target: shopMotivationSchemaTargetSchema,
    rules: z.array(shopSalaryRuleResponseSchema),
    updatedAt: z.coerce.date(),
});

export type ShopMotivationSchemaDetailResponse = z.infer<
    typeof shopMotivationSchemaDetailResponseSchema
>;

// PATCH /v1/shop/accounting/motivation-schema/:id — переименование + полная
// замена набора правил направления shop этой схемы (см. app.routes.ts/
// UpdateShopMotivationSchemaHandler). Без targetType/targetId — цель схемы
// на редактировании не меняется.
const updateShopMotivationSchemaRequestSchema = z.object({
    name: z.string(),
    rules: z.array(shopSalaryRuleRequestSchema),
});

export type UpdateShopMotivationSchemaRequest = z.infer<
    typeof updateShopMotivationSchemaRequestSchema
>;

export {
    ShopMotivationRequestSchema,
    shopMotivationSchemaTargetSchema,
    shopMotivationSchemaListItemSchema,
    listShopMotivationSchemasQuerySchema,
    listShopMotivationSchemasResponseSchema,
    shopMotivationSchemaDetailResponseSchema,
    updateShopMotivationSchemaRequestSchema,
};
