import { z } from 'zod';
import {
    individualBonusFieldSchema,
    percentBordersSchema,
    salaryRuleTypeInfoSchema,
    salaryRuleTypesResponseSchema,
    targetRoleSchema,
} from './salary-rule';

// Контракты зарплатных правил направления `shop` (Фаза 12, issue #57/#60,
// см. docs/payroll/plan-payroll-calculation.md). Отдельный
// discriminatedUnion, НЕ смешанный с сервисным `salaryRuleRequestSchema`
// (contracts/commands/salary-rule.ts) — состав типов правил разный
// (`PayPerHour`/`ProductSold` здесь, `PayPerHour`/`ServiceCompleted`/
// `OrderPayed`/`TaskCompleted` у сервиса), а `type: 'PayPerHour'` у обоих
// направлений совпадает буквально — смешение узла discriminatedUnion дало
// бы неоднозначный тип. `targetRoleSchema`/`percentBordersSchema`/
// `individualBonusFieldSchema` — переиспользованы напрямую из
// `salary-rule.ts`: это НЕ бизнес-логика (issue #57 запрещает
// переиспользовать именно её), а разделяемый примитивный словарь форм
// (см. комментарий у targetRoleSchema в salary-rule.ts). Модуль спроектирован
// так, чтобы Фаза 13 (`UsedProductSold`, `TaskCompleted` магазина, issue
// #62/#64) добавила ещё два члена в `shopSalaryRuleRequestSchema` без
// изменения уже существующих.

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
// поля (hours приходит из ручного ввода EmployeeHoursEntry, общей для
// обоих направлений таблицы, см. domains/shop/modules/accounting/CLAUDE
// комментарии на бэкенде), но отдельный литерал схемы, чтобы направления
// не были технически связаны одним объектом.
const payPerHourShopSalaryConfigSchema = z.object({
    price: z.number(),
    bonus: individualBonusFieldSchema,
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
    bonus: individualBonusFieldSchema,
});

const productSoldSalaryRuleSchema = z.object({
    type: z.literal('ProductSold'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: productSoldSalaryConfigSchema,
});

// ========================== Итоговый дискриминированный союз ========================== //

const shopSalaryRuleRequestSchema = z.discriminatedUnion('type', [
    payPerHourShopSalaryRuleSchema,
    productSoldSalaryRuleSchema,
]);

export type ShopSalaryRuleRequest = z.infer<typeof shopSalaryRuleRequestSchema>;

// ========================== Список типов правил магазина для UI ========================== //

// Форма ответа идентична сервисной (salaryRuleTypeInfoSchema/
// salaryRuleTypesResponseSchema) — генерик «тип + допустимые роли», без
// направления в самой форме (направление уже подразумевается тем, какой
// HTTP-роут вызван — GET /shop/accounting/salary_role_types против
// GET /accounting/salary_role_types сервиса), поэтому переиспользуется тот
// же экспортированный zod-схема-тип, а не дублируется.
export {
    shopSalaryRuleRequestSchema,
    shopSalaryBasisSchema,
    payPerHourShopSalaryConfigSchema,
    productSoldSalaryConfigSchema,
    salaryRuleTypeInfoSchema as shopSalaryRuleTypeInfoSchema,
    salaryRuleTypesResponseSchema as shopSalaryRuleTypesResponseSchema,
};
