import { z } from 'zod';
import {
    percentBordersSchema,
    salaryRuleTypeInfoSchema,
    salaryRuleTypesResponseSchema,
    targetRoleSchema,
} from './salary-rule';

// Контракты зарплатных правил направления `shop` (Фаза 12/13, issue
// #57/#60/#62/#64, см. docs/payroll/plan-payroll-calculation.md). Отдельный
// discriminatedUnion, НЕ смешанный с сервисным `salaryRuleRequestSchema`
// (contracts/commands/salary-rule.ts) — состав типов правил разный
// (`PayPerHour`/`ProductSold`/`UsedProductSold` здесь,
// `PayPerHour`/`ServiceCompleted`/`OrderPayed` у сервиса), а
// `type: 'PayPerHour'` у обоих направлений совпадает буквально — смешение
// узла discriminatedUnion дало бы неоднозначный тип (то же решение и по той
// же причине, что и для `PayPerHour` в Фазе 12). `targetRoleSchema`/
// `percentBordersSchema` — переиспользованы напрямую из
// `salary-rule.ts`: это НЕ бизнес-логика (issue #57 запрещает
// переиспользовать именно её), а разделяемый примитивный словарь форм
// (см. комментарий у targetRoleSchema в salary-rule.ts).

// ========================== База начисления магазина ========================== //

// REVENUE (MoySkladDemandPosition.sum) / MARGIN (...profit) — у магазина
// НЕТ третьего варианта SALARY_MINUS_ENGINEER_SALARY сервиса: в магазине
// нет роли инженера и нет engineerSalary как таковой (см.
// docs/payroll/prd-payroll-calculation.md, раздел "Роли магазина" и issue
// #59) — поэтому отдельный enum, а не salaryBasisSchema сервиса.
const shopSalaryBasisSchema = z.enum(['REVENUE', 'MARGIN']);

export type ShopSalaryBasis = z.infer<typeof shopSalaryBasisSchema>;

// ========================== Почасовая ставка ========================== //

// Зеркало payPerHourSalaryConfigSchema сервиса (Фаза 12) — тот же смысл
// поля (hours приходит из суммы часов рабочих смен графика,
// WorkScheduleEntry.status = WORKING, общей для обоих направлений таблицы,
// см. docs/employee-work-schedule, Фаза 5, и
// domains/shop/modules/accounting/CLAUDE комментарии на бэкенде), но
// отдельный литерал схемы, чтобы направления не были технически связаны
// одним объектом.
const payPerHourShopSalaryConfigSchema = z.object({
    price: z.number(),
});

const payPerHourShopSalaryRuleSchema = z.object({
    type: z.literal('PayPerHour'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: payPerHourShopSalaryConfigSchema,
});

// ========================== За проданный товар ========================== //

// category — id папки MoySkladProductFolder (корень категории, потомки
// раскрываются на бэкенде через ProductFolderTreeService,
// pathName LIKE 'root%'); null — правило действует на все товары без
// ограничения по категории (issue #60: "правило без категории означает
// «все товары»"). Категория — обязательная ЧАСТЬ правила (пара «категория
// × награда»), поэтому поле обязательное (может быть только явным null, а
// не отсутствовать).
const productSoldSalaryConfigSchema = z.object({
    category: z.string().nullable(),
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({
            type: z.literal('FixedPercent'),
            percent: z.number(),
            salaryBasis: shopSalaryBasisSchema,
        }),
        z.object({
            type: z.literal('FloatPercent'),
            basePercent: z.number(),
            salaryBasis: shopSalaryBasisSchema,
            percentBorders: percentBordersSchema,
        }),
    ]),
});

const productSoldSalaryRuleSchema = z.object({
    type: z.literal('ProductSold'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: productSoldSalaryConfigSchema,
});

// ========================== Вознаграждение закупщику БУ техники ========================== //

// Фаза 13 (issue #62/#63) — закупщик выкупленной у клиента БУ техники
// получает вознаграждение, когда устройство ПРОДАНО (попало в отгрузку
// периода), а не когда выкуплено: источник данных — тот же
// MoySkladDemandPosition, что и у ProductSold (см. issue #63: "не изобретай
// отдельный источник данных под выкуп"), только матчинг идёт по полю
// закупщика (ONLINE_PURCHASER/OFFLINE_PURCHASER), а не менеджера. category —
// та же необязательная часть правила, что у ProductSold (ставка за БУ айфон
// и за БУ ноутбук может отличаться, issue #62). FloatPercent НЕ
// предусмотрен — вознаграждение закупщика не привязано к выполнению плана
// продаж (PRD, раздел "Закупщики БУ техники").
const usedProductSoldSalaryConfigSchema = z.object({
    category: z.string().nullable(),
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({
            type: z.literal('FixedPercent'),
            percent: z.number(),
            salaryBasis: shopSalaryBasisSchema,
        }),
    ]),
});

const usedProductSoldSalaryRuleSchema = z.object({
    type: z.literal('UsedProductSold'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: usedProductSoldSalaryConfigSchema,
});

// ========================== Итоговый дискриминированный союз ========================== //

const shopSalaryRuleRequestSchema = z.discriminatedUnion('type', [
    payPerHourShopSalaryRuleSchema,
    productSoldSalaryRuleSchema,
    usedProductSoldSalaryRuleSchema,
]);

export type ShopSalaryRuleRequest = z.infer<typeof shopSalaryRuleRequestSchema>;

// ========================== Ответ (правило с id) ========================== //

// Зеркало salaryRuleResponseSchema сервиса (contracts/commands/salary-rule.ts,
// страница просмотра/редактирования зарплатных схем) — тот же
// shopSalaryRuleRequestSchema, но с добавленным `id` на каждом варианте
// union'а. Нужен для GET /v1/shop/accounting/motivation-schema/:id (rules[])
// и как строительный блок ShopMotivationSchemaDetailResponse
// (shop-motivation-schema.ts) — предзаполнение формы редактирования на
// фронте, в отличие от shopSalaryRuleRequestSchema, требует знать id уже
// существующего правила.
const shopSalaryRuleResponseSchema = z.discriminatedUnion('type', [
    payPerHourShopSalaryRuleSchema.extend({ id: z.string() }),
    productSoldSalaryRuleSchema.extend({ id: z.string() }),
    usedProductSoldSalaryRuleSchema.extend({ id: z.string() }),
]);

export type ShopSalaryRuleResponse = z.infer<
    typeof shopSalaryRuleResponseSchema
>;

// ========================== Список типов правил магазина для UI ========================== //

// Форма ответа идентична сервисной (salaryRuleTypeInfoSchema/
// salaryRuleTypesResponseSchema) — генерик «тип + допустимые роли», без
// направления в самой форме (направление уже подразумевается тем, какой
// HTTP-роут вызван — GET /shop/accounting/salary_role_types против
// GET /accounting/salary_role_types сервиса), поэтому переиспользуется тот
// же экспортированный zod-схема-тип, а не дублируется.
export {
    shopSalaryRuleRequestSchema,
    shopSalaryRuleResponseSchema,
    shopSalaryBasisSchema,
    payPerHourShopSalaryConfigSchema,
    productSoldSalaryConfigSchema,
    usedProductSoldSalaryConfigSchema,
    salaryRuleTypeInfoSchema as shopSalaryRuleTypeInfoSchema,
    salaryRuleTypesResponseSchema as shopSalaryRuleTypesResponseSchema,
};
