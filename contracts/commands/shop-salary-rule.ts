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

// id (опционально) — зеркало salary-rule.ts (см. WHY там): используется
// ТОЛЬКО телом PATCH .../shop/accounting/motivation-schema/:id, чтобы
// отличить "правило отредактировано на месте" от "правило удалено и
// создано новое".
const payPerHourShopSalaryRuleSchema = z.object({
    id: z.string().optional(),
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
        // "Продажа товара Б/У" (вариант награды `ProductSold`, а не отдельный тип правила — не
        // путать с `UsedProductSold` ниже, тем про закупщиков) — та же формула FloatPercent, но с
        // порогом по МАРЖЕ конкретной позиции: маржа >= marginThreshold считается по FloatPercent
        // (basePercent × множитель плана), с минимальной суммой floorAmount; маржа < marginThreshold
        // — фиксированный процент от цены продажи (REVENUE), lowMarginPercent, вместо базовой
        // формулы. Расчёт идёт по каждой позиции отдельно (см. product-sold.entity.ts), не
        // агрегированно.
        z.object({
            type: z.literal('FloatPercentMarginFloor'),
            basePercent: z.number(),
            salaryBasis: shopSalaryBasisSchema,
            percentBorders: percentBordersSchema,
            marginThreshold: z.number(),
            floorAmount: z.number(),
            lowMarginPercent: z.number(),
        }),
    ]),
});

const productSoldSalaryRuleSchema = z.object({
    id: z.string().optional(),
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
    id: z.string().optional(),
    type: z.literal('UsedProductSold'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: usedProductSoldSalaryConfigSchema,
});

// ========================== За выполнение задачи ========================== //

// Независимая копия сервисной пары taskCompletionSalaryConfigRequestSchema/
// ...ResponseSchema (contracts/commands/salary-rule.ts) — issue #57, тот же приём, что и у
// остальных типов правил этого файла ("не смешивай контракты" направлений через общий
// discriminatedUnion).
//
// split-task-completion-rule-form — зеркало разделения сервисного контракта на два раздельных
// сценария (design.md, решение 1), discriminatedUnion по `isRecurring`, а не общий плоский объект с
// одним `taskId`: разовая задача теперь создаётся тем же запросом, что и правило (буквальные
// title/deadline/description/links здесь же), регулярная — как раньше, шаблон для
// авто-пересоздания, плюс новое поле createTaskForCurrentPeriod (галочка «Создать задачу в текущем
// периоде»). См. WHY в salary-rule.ts — зеркало дословно, независимая копия (issue #57).
// add-task-rule-task-lifecycle — зеркало taskLinkTemplateSchema в salary-rule.ts (независимая
// копия, issue #57).
const shopTaskLinkTemplateSchema = z.object({
    url: z.string().url(),
    label: z.string().optional(),
});

export type ShopTaskLinkTemplate = z.infer<typeof shopTaskLinkTemplateSchema>;

const shopAccountingPeriodFieldSchema = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Период должен быть в формате YYYY-MM');

const shopDeadlinePeriodOffsetSchema = z.number().int().min(0).max(3).default(0);

const shopDefaultAmountFieldSchema = z.number().int().nonnegative();

// Зеркало taskCompletionOneOffConfigRequestSchema (salary-rule.ts) — `.optional()` по той же
// причине: этот же контракт обслуживает и PATCH существующего разового правила, где задача уже
// создана и её содержимое этой формой больше не трогается.
const taskCompletionShopOneOffConfigRequestSchema = z.object({
    isRecurring: z.literal(false),
    taskTitle: z.string().min(1).optional(),
    taskDescription: z.string().optional(),
    taskDeadline: z.string().optional(),
    taskLinks: z.array(shopTaskLinkTemplateSchema).optional(),
    defaultAmount: shopDefaultAmountFieldSchema,
    accountingPeriod: shopAccountingPeriodFieldSchema,
});

const taskCompletionShopRecurringConfigRequestSchema = z.object({
    isRecurring: z.literal(true),
    taskTitleTemplate: z.string(),
    taskDescriptionTemplate: z.string().optional(),
    deadlineTemplate: z.string(),
    deadlinePeriodOffset: shopDeadlinePeriodOffsetSchema,
    taskLinkTemplates: z.array(shopTaskLinkTemplateSchema).optional(),
    // Чекбокс «Создать задачу в текущем периоде» — зеркало salary-rule.ts, независимая копия.
    createTaskForCurrentPeriod: z.boolean().default(true),
    defaultAmount: shopDefaultAmountFieldSchema,
    accountingPeriod: shopAccountingPeriodFieldSchema,
});

const taskCompletionShopSalaryConfigRequestSchema = z.discriminatedUnion('isRecurring', [
    taskCompletionShopOneOffConfigRequestSchema,
    taskCompletionShopRecurringConfigRequestSchema,
]);

export type TaskCompletionShopSalaryConfigRequest = z.infer<
    typeof taskCompletionShopSalaryConfigRequestSchema
>;

// Зеркало taskCompletion*ConfigResponseSchema (salary-rule.ts) — не эхом отдаёт буквальные поля
// разовой задачи (одноразовый вход, как раньше был taskId); регулярный сценарий по-прежнему
// возвращает шаблон целиком для предзаполнения формы редактирования (draftFromShopRule).
const taskCompletionShopOneOffConfigResponseSchema = z.object({
    isRecurring: z.literal(false),
    defaultAmount: shopDefaultAmountFieldSchema,
    taskIdByPeriod: z.record(z.string(), z.string()),
    accountingPeriod: shopAccountingPeriodFieldSchema.optional(),
});

const taskCompletionShopRecurringConfigResponseSchema = z.object({
    isRecurring: z.literal(true),
    taskTitleTemplate: z.string(),
    taskDescriptionTemplate: z.string().optional(),
    deadlineTemplate: z.string(),
    deadlinePeriodOffset: shopDeadlinePeriodOffsetSchema,
    taskLinkTemplates: z.array(shopTaskLinkTemplateSchema).optional(),
    defaultAmount: shopDefaultAmountFieldSchema,
    taskIdByPeriod: z.record(z.string(), z.string()),
    accountingPeriod: shopAccountingPeriodFieldSchema.optional(),
});

const taskCompletionShopSalaryConfigResponseSchema = z.discriminatedUnion('isRecurring', [
    taskCompletionShopOneOffConfigResponseSchema,
    taskCompletionShopRecurringConfigResponseSchema,
]);

export type TaskCompletionShopSalaryConfigResponse = z.infer<
    typeof taskCompletionShopSalaryConfigResponseSchema
>;

const taskCompletionShopSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('TaskCompletion'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: taskCompletionShopSalaryConfigRequestSchema,
});

// ================= Уровень отдела/направления (add-department-head-salary-rules) ================= //
//
// Implements FR1-FR4 of add-department-head-salary-rules.
//
// Зеркало трёх новых видов правила из salary-rule.ts (service), см. WHY там — независимая копия
// (issue #57), состав полей идентичен по смыслу, отличия: shopSalaryBasisSchema вместо
// salaryBasisSchema (нет SALARY_MINUS_ENGINEER_SALARY — в магазине нет роли инженера) и
// warehouseId: string (MoySklad UUID, как shopGoodsTurnoverReportLineSchema.warehouseId) вместо
// number (RoApp warehouse id) у service.

// Временный костыль поверх add-department-head-salary-rules design.md Decision 1 (зеркало WHY у
// departmentIdOverrideSchema в salary-rule.ts) — явное переопределение отдела, чей план продаж
// используется, для случая, когда у собственного отдела сотрудника ещё нет плана. `.optional()` (не
// `.default()`) — иначе z.infer сделал бы поле обязательным в выводном типе и сломал компиляцию
// мест, где config собирается литералом без него.
const departmentIdOverrideShopSchema = z.number().nullable().optional();

// DepartmentPercent (FR2, shop) — % от факта выручки/маржи категории/магазина, без коэффициента.
const departmentPercentShopSalaryConfigSchema = z.object({
    salaryBasis: shopSalaryBasisSchema,
    category: z.string().nullable(),
    percent: z.number(),
    departmentId: departmentIdOverrideShopSchema,
});

export type DepartmentPercentShopSalaryConfig = z.infer<
    typeof departmentPercentShopSalaryConfigSchema
>;

const departmentPercentShopSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('DepartmentPercent'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: departmentPercentShopSalaryConfigSchema,
});

// DepartmentPlanBonus (FR3, shop) — фиксированная сумма × плавающий коэффициент выполнения плана
// продаж по выручке/марже, переиспользует существующий percentBordersSchema.
const departmentPlanBonusShopSalaryConfigSchema = z.object({
    salaryBasis: shopSalaryBasisSchema,
    category: z.string().nullable(),
    fixedAmount: z.number(),
    percentBorders: percentBordersSchema,
    departmentId: departmentIdOverrideShopSchema,
});

export type DepartmentPlanBonusShopSalaryConfig = z.infer<
    typeof departmentPlanBonusShopSalaryConfigSchema
>;

const departmentPlanBonusShopSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('DepartmentPlanBonus'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: departmentPlanBonusShopSalaryConfigSchema,
});

// DepartmentTurnoverBonus (FR4, shop) — фиксированная сумма × плавающий коэффициент выполнения
// плана по коэффициенту оборачиваемости конкретного склада МойСклад (warehouseId — обязательное
// поле, строковый UUID); planTurnoverRatio хранится прямо в конфигурации правила.
const departmentTurnoverBonusShopSalaryConfigSchema = z.object({
    warehouseId: z.string(),
    category: z.string().nullable(),
    fixedAmount: z.number(),
    planTurnoverRatio: z.number(),
    percentBorders: percentBordersSchema,
});

export type DepartmentTurnoverBonusShopSalaryConfig = z.infer<
    typeof departmentTurnoverBonusShopSalaryConfigSchema
>;

const departmentTurnoverBonusShopSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('DepartmentTurnoverBonus'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: departmentTurnoverBonusShopSalaryConfigSchema,
});

// ========================== Итоговый дискриминированный союз ========================== //

const shopSalaryRuleRequestSchema = z.discriminatedUnion('type', [
    payPerHourShopSalaryRuleSchema,
    productSoldSalaryRuleSchema,
    usedProductSoldSalaryRuleSchema,
    taskCompletionShopSalaryRuleSchema,
    departmentPercentShopSalaryRuleSchema,
    departmentPlanBonusShopSalaryRuleSchema,
    departmentTurnoverBonusShopSalaryRuleSchema,
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
// taskCompletion — не .extend({ id }) поверх request-схемы: config различается между запросом и
// ответом (taskId vs taskIdByPeriod, см. taskCompletionShopSalaryConfigResponseSchema выше), форма
// строится заново с config-схемой ответа (тот же приём, что и в salary-rule.ts).
const taskCompletionShopSalaryRuleResponseSchema = z.object({
    id: z.string(),
    type: z.literal('TaskCompletion'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: taskCompletionShopSalaryConfigResponseSchema,
    // Soft-деактивация зарплатного правила — правило не удаляется физически,
    // а перестаёт участвовать в расчётах и пропадает из UI схемы. Только
    // ответ — форма создания/редактирования правила им не управляет (см.
    // request-схемы выше, где isActive отсутствует).
    isActive: z.boolean(),
});

const shopSalaryRuleResponseSchema = z.discriminatedUnion('type', [
    payPerHourShopSalaryRuleSchema.extend({ id: z.string(), isActive: z.boolean() }),
    productSoldSalaryRuleSchema.extend({ id: z.string(), isActive: z.boolean() }),
    usedProductSoldSalaryRuleSchema.extend({ id: z.string(), isActive: z.boolean() }),
    taskCompletionShopSalaryRuleResponseSchema,
    departmentPercentShopSalaryRuleSchema.extend({ id: z.string() }),
    departmentPlanBonusShopSalaryRuleSchema.extend({ id: z.string() }),
    departmentTurnoverBonusShopSalaryRuleSchema.extend({ id: z.string() }),
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
    taskCompletionShopSalaryConfigRequestSchema,
    taskCompletionShopSalaryConfigResponseSchema,
    shopTaskLinkTemplateSchema,
    departmentPercentShopSalaryConfigSchema,
    departmentPlanBonusShopSalaryConfigSchema,
    departmentTurnoverBonusShopSalaryConfigSchema,
    salaryRuleTypeInfoSchema as shopSalaryRuleTypeInfoSchema,
    salaryRuleTypesResponseSchema as shopSalaryRuleTypesResponseSchema,
};
