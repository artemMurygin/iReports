import { z } from 'zod';
import { salaryAccrualStatusSchema } from './salary-accrual-status';
import { salesDirectionSchema } from './sales-plan';

// ========================== Роль правила ========================== //

// Роль, за которую платит правило — общее поле рядом с type/name, а не
// часть config (см. docs/payroll/prd-payroll-calculation.md, раздел 2).
// Единый перечень для ОБОИХ направлений (service/shop), а не два отдельных
// enum'а: ONLINE_MANAGER/OFFLINE_MANAGER — одно и то же бизнес-понятие в
// обеих ERP (просто разные поля-источники, см. domain/services/
// service-role-source.ts у service и domain/services/shop-role-source.ts
// у shop), поэтому расширяем этот же shared-enum, а не заводим копию в
// shop-salary-rule.ts. ONLINE_PURCHASER / OFFLINE_PURCHASER (Фаза 12,
// см. docs/payroll/prd-payroll-calculation.md, раздел "Роли магазина") —
// роли, специфичные для shop (закупщики БУ техники на уровне товарной
// позиции, targetRole правил PayPerHour/ProductSold в этой фазе их не
// использует — задел под UsedProductSold, Фаза 13). У сервисных типов
// правил они недостижимы (SalaryRuleFactory/registry сервиса их просто не
// матчит ни в одном правиле), поэтому смешение в одном enum безопасно —
// "не смешивай контракты" (issue #60) относится к discriminatedUnion типов
// правил (PayPerHour/ProductSold/... vs PayPerHour/ServiceCompleted/...),
// а не к этому вспомогательному enum'у.
//
// OFFICE (Фаза 2 плана "График работы сотрудников") — роль офисного
// сотрудника (не инженер и не менеджер продаж/заказов), нужна графику работы
// (WorkScheduleEntry.role, contracts/commands/work-schedule.ts), а не
// зарплатным правилам: ни один SalaryRule её сегодня не матчит, поэтому она
// намеренно не входит в ALL_SERVICE_ROLES/ALL_SHOP_ROLES каталогов
// salary-rule-role-catalog.ts обоих направлений — GET .../salary_role_types
// её не предлагает.
//
// SOLO_MANAGER — роль сотрудника графика работы (WorkScheduleEntry.role),
// совмещающего онлайн- и офлайн-обязанности менеджера в одиночку. В отличие
// от OFFICE, эта роль участвует в расчёте зарплаты: она включена в
// PAY_PER_HOUR_ELIGIBLE_ROLES (domain/services/pay-per-hour-roles.ts) наравне
// с ONLINE_MANAGER/OFFLINE_MANAGER, поэтому часы рабочих смен с этой ролью
// засчитываются в почасовую оплату (PayPerHour). В ALL_SERVICE_ROLES она,
// как и OFFICE, намеренно не входит — остальные два типа правил сервиса
// (ServiceCompleted/OrderPayed) матчат сотрудника через
// service-role-source.ts, где у неё нет собственного поля ERP.
//
// DEPARTMENT_HEAD (add-department-head-salary-rules, FR1) — «руководитель направления»: мотивация
// зависит не от личных транзакций сотрудника, а от результата отдела/категории/направления целиком
// (DepartmentPercent/DepartmentPlanBonus/DepartmentTurnoverBonus ниже). Назначается ВРУЧНУЮ через
// уже существующий targetType = 'Employee' — без синка Bitrix24 UF_HEAD и без новой сущности «глава
// отдела» (design.md Decision 1: осознанно отклонённая альтернатива). role-source.ts не расширяется
// под эту роль — 3 новых вида правил не матчат сотрудника по заказу/отгрузке, они всегда считаются
// целиком на того единственного сотрудника, кому назначена схема (design.md Decision 2). В
// ALL_SERVICE_ROLES/ALL_SHOP_ROLES входит — единственная цель добавления в каталог: чтобы UI
// показывал роль как опцию для этих 3 новых видов правил (design.md Decision 4).
const targetRoleSchema = z.enum([
    'ENGINEER',
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
    'ORDER_MANAGER',
    'ONLINE_PURCHASER',
    'OFFLINE_PURCHASER',
    'OFFICE',
    'SOLO_MANAGER',
    'DEPARTMENT_HEAD',
]);

export type TargetRole = z.infer<typeof targetRoleSchema>;

// База начисления процентных правил OrderPayed (Фаза 8): REVENUE (выручка
// заказа), MARGIN (маржа), SALARY_MINUS_ENGINEER_SALARY (сумма за вычетом
// зарплаты инженера). См. docs/payroll/prd-payroll-calculation.md, раздел 2.
const salaryBasisSchema = z.enum([
    'REVENUE',
    'MARGIN',
    'SALARY_MINUS_ENGINEER_SALARY',
]);

export type SalaryBasis = z.infer<typeof salaryBasisSchema>;

// Один из трёх порогов FloatPercent — { fromPlanPercent, multiplier, mode }.
// mode лежит на каждом пороге отдельно (а не одним полем на весь award) —
// так задан контракт в PRD ("каждый — { fromPlanPercent, multiplier, mode }");
// смысл: mode описывает, что происходит НА ЭТОМ пороге и ДАЛЬШЕ, вплоть до
// следующего порога (или до бесконечности, если порог последний по
// fromPlanPercent):
// - FIX    — множитель ступенькой: от этого порога и до следующего действует
//            множитель ЭТОГО порога;
// - LINEAR — множитель на участке пропорционален проценту выполнения плана:
//            multiplier ЭТОГО порога × (percentCompletion / 100); multiplier
//            следующего порога в расчёте на этом участке не участвует —
//            вступает в силу только когда сам становится текущим порогом.
// См. domain/services/float-percent.ts в service и
// domain/value-objects/float-percent-schedule.value-object.ts в shop —
// независимые, но идентичные по семантике реализации.
const percentBorderSchema = z.object({
    name: z.string(),
    fromPlanPercent: z.number(),
    multiplier: z.number(),
    mode: z.enum(['FIX', 'LINEAR']),
});

export type PercentBorder = z.infer<typeof percentBorderSchema>;

const percentBordersSchema = z.tuple([
    percentBorderSchema,
    percentBorderSchema,
    percentBorderSchema,
]);

// ========================== Почасовая ставка ========================== //

// hours больше не часть config: источник часов — сумма часов рабочих смен
// графика сотрудника за период (WorkScheduleEntry.status = WORKING, см.
// docs/employee-work-schedule, Фаза 5; заменил прежний ручной ввод
// EmployeeHoursEntry из Фазы 7 плана), а не захардкоженное значение в
// правиле. price — ставка за час.
const payPerHourSalaryConfigSchema = z.object({
    price: z.number(),
});

// id (опционально) — используется ТОЛЬКО телом PATCH .../motivation-schema/:id
// (UpdateMotivationSchemaHandler): наличие id уже существующего правила
// говорит бэкенду, что это то же правило, отредактированное на месте (запись
// в БД обновляется, id/связанные сущности вроде задачи Bitrix24 у
// TaskCompletion сохраняются), а не новое взамен старого. Отсутствие id —
// новое правило (создаётся с нуля, как и раньше). Для POST-создания схемы id
// не передаётся и игнорируется, если передан. См. design.md Decision 6
// (add-task-based-salary-rule) — без этого поля PATCH не может отличить
// "правило не менялось/отредактировано" от "правило удалено и создано новое",
// что для TaskCompletion means удаление и пересоздание Bitrix-задачи при
// КАЖДОМ PATCH, даже когда правило не менялось.
const payPerHourSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('PayPerHour'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: payPerHourSalaryConfigSchema,
});

// ========================== За выполненную услугу ========================== //

// orderTypeIds (Фаза 3, docs/service-plan-salary-rule-order-category-filter)
// — фильтр по категории заказа, т.е. RoappOrderType (RoappOrder.orderTypeId),
// НЕ SalesPlan.category и не RoappServiceCategory/RoappProductCategory.
// Пусто/не указано — правило учитывает заказы всех типов.
const serviceCompletedSalaryConfigSchema = z.object({
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({ type: z.literal('ServiceFixed') }),
        z.object({ type: z.literal('ServicePercent'), percent: z.number() }),
    ]),
    orderTypeIds: z.array(z.number()).optional(),
});

const serviceCompletedSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('ServiceCompleted'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: serviceCompletedSalaryConfigSchema,
});

// ========================== За оплаченный заказ ========================== //

// Расчёт опирается на исходные суммы заказа (RoappOrder.payed/cost/
// engineerSalary), а не на предрассчитанный legacy-KPI RoappOrder.managerSalary
// (жёстко зашитые 10% в sync/roapp) — см. PRD, "Технические ограничения",
// и план, Фаза 8.
// orderTypeIds (Фаза 3, docs/service-plan-salary-rule-order-category-filter)
// — фильтр по категории заказа, т.е. RoappOrderType (RoappOrder.orderTypeId),
// НЕ SalesPlan.category и не RoappServiceCategory/RoappProductCategory.
// Пусто/не указано — правило учитывает заказы всех типов.
const orderPayedSalaryConfigSchema = z.object({
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({
            type: z.literal('FixedPercent'),
            percent: z.number(),
            salaryBasis: salaryBasisSchema,
        }),
        z.object({
            type: z.literal('FloatPercent'),
            basePercent: z.number(),
            salaryBasis: salaryBasisSchema,
            percentBorders: percentBordersSchema,
        }),
    ]),
    orderTypeIds: z.array(z.number()).optional(),
});

const orderPayedSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('OrderPayed'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: orderPayedSalaryConfigSchema,
});

// ========================== За выполнение задачи ========================== //

// Задача (`ireports-contracts` `task.ts`, модуль `tasks`) — самостоятельная сущность; модуль
// `tasks` о правилах не знает вообще (specs/tasks/spec.md «Задача — полностью самостоятельная
// сущность»). Правило само хранит связь «период → задача» в config.taskIdByPeriod.
//
// split-task-completion-rule-form — форма создания правила разделена на два раздельных сценария
// (design.md, решение 1), а не общий набор полей с одним переключателем `isRecurring`, поэтому
// сам контракт запроса — discriminatedUnion по `isRecurring`, а не один плоский объект:
// - `isRecurring: false` (разовая задача) — задача больше НЕ создаётся отдельным, предшествующим
//   запросом `POST /v1/tasks` (так было до этого change — см. replace-bitrix-task-integration): её
//   буквальные название/дедлайн/описание/ссылки указываются прямо здесь и уходят в один и тот же
//   запрос на создание правила; бэкенд создаёт задачу сам (CreateSalaryRuleHandler, тот же
//   CommandBus-путь accounting → tasks, что и у EnsureRuleTaskForPeriodService) и сохраняет её id
//   как config.taskIdByPeriod[accountingPeriod] — одна задача на всё время жизни разового правила,
//   дальше не пересоздаётся.
// - `isRecurring: true` (регулярная задача) — как и раньше, шаблон для авто-пересоздания задачи на
//   каждый новый период (EnsureRuleTaskForPeriodService), плюс новое поле
//   createTaskForCurrentPeriod (галочка «Создать задачу в текущем периоде», design.md/ui-design.md):
//   определяет, создаётся ли задача ТЕКУЩЕГО периода сразу при создании правила, или первая задача
//   появится только при наступлении следующего периода (тот же ленивый механизм, что и раньше).
const taskLinkTemplateSchema = z.object({
    url: z.string().url(),
    label: z.string().optional(),
});

export type TaskLinkTemplate = z.infer<typeof taskLinkTemplateSchema>;

const accountingPeriodFieldSchema = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Период должен быть в формате YYYY-MM');

// Смещение периода дедлайна регулярной задачи относительно расчётного периода
// (recurring-task-deadline-offset, FR1/design.md): 0 — дедлайн в месяце периода задачи,
// 1..3 — на 1..3 месяца вперёд. Дефолт 0 — обратная совместимость с уже персистированными
// правилами (легаси-строки трактуются как прежнее поведение, см. SalaryRuleMapper.toDomain).
const deadlinePeriodOffsetSchema = z.number().int().min(0).max(3).default(0);

// Сумма начисления по умолчанию — подставляется в строку начисления, когда задача закрыта успешно
// (TaskCompletion.calculate()), руководитель может изменить её при проведении (см.
// setTaskCompletionLineRewardRequestSchema в salary-accrual.ts). Общее поле для обоих сценариев.
const defaultAmountFieldSchema = z.number().int().nonnegative();

// Разовая задача — буквальные поля самой (единственной) задачи. `.optional()` не потому, что они не
// нужны при создании (там они обязательны — CreateSalaryRuleHandler отклоняет их отсутствие явным
// исключением), а потому, что этот же контракт обслуживает и PATCH .../motivation-schema/:id
// редактирования УЖЕ существующего разового правила: там задача уже создана и её содержимое этой
// формой больше не трогается (см. TaskCompletionRuleFields.tsx — поля задачи показываются только
// пока draft.taskId ещё пуст), поэтому фронт их просто не присылает.
const taskCompletionOneOffConfigRequestSchema = z.object({
    isRecurring: z.literal(false),
    taskTitle: z.string().min(1).optional(),
    taskDescription: z.string().optional(),
    taskDeadline: z.string().optional(),
    taskLinks: z.array(taskLinkTemplateSchema).optional(),
    defaultAmount: defaultAmountFieldSchema,
    accountingPeriod: accountingPeriodFieldSchema,
});

const taskCompletionRecurringConfigRequestSchema = z.object({
    isRecurring: z.literal(true),
    taskTitleTemplate: z.string(),
    taskDescriptionTemplate: z.string().optional(),
    deadlineTemplate: z.string(),
    deadlinePeriodOffset: deadlinePeriodOffsetSchema,
    taskLinkTemplates: z.array(taskLinkTemplateSchema).optional(),
    // Чекбокс «Создать задачу в текущем периоде» (split-task-completion-rule-form) — только при
    // создании нового регулярного правила; на PATCH существующего игнорируется (задача текущего
    // периода уже либо есть, либо нет — этой формой больше не пересоздаётся). Default true — то же
    // поведение, что было раньше неявно (задача создавалась сразу вместе с правилом).
    createTaskForCurrentPeriod: z.boolean().default(true),
    defaultAmount: defaultAmountFieldSchema,
    accountingPeriod: accountingPeriodFieldSchema,
});

const taskCompletionSalaryConfigRequestSchema = z.discriminatedUnion('isRecurring', [
    taskCompletionOneOffConfigRequestSchema,
    taskCompletionRecurringConfigRequestSchema,
]);

export type TaskCompletionSalaryConfigRequest = z.infer<
    typeof taskCompletionSalaryConfigRequestSchema
>;

// Ответ API — зеркалит разделение запроса на два сценария, но НЕ эхом отдаёт буквальные поля
// разовой задачи (title/deadline/description/links) — они одноразовый вход, как раньше был taskId:
// уже созданная задача читается через её собственный `GET /v1/tasks/:id` (см. `useRuleTask`,
// frontend), не через это API. Регулярный сценарий по-прежнему возвращает шаблон целиком — форма
// редактирования предзаполняется им напрямую (draftFromRule/draftFromShopRule).
const taskCompletionOneOffConfigResponseSchema = z.object({
    isRecurring: z.literal(false),
    defaultAmount: defaultAmountFieldSchema,
    taskIdByPeriod: z.record(z.string(), z.string()),
    // Опционально (в отличие от запроса) — уже персистированные правила, созданные до этой фичи, не
    // имеют этого поля в SalaryRule.props; SalaryRuleMapper.toDomain дерива́т его из taskIdByPeriod
    // при чтении (add-task-salary-rule-accounting-period, design.md Decision 1).
    accountingPeriod: accountingPeriodFieldSchema.optional(),
});

const taskCompletionRecurringConfigResponseSchema = z.object({
    isRecurring: z.literal(true),
    taskTitleTemplate: z.string(),
    taskDescriptionTemplate: z.string().optional(),
    deadlineTemplate: z.string(),
    deadlinePeriodOffset: deadlinePeriodOffsetSchema,
    taskLinkTemplates: z.array(taskLinkTemplateSchema).optional(),
    defaultAmount: defaultAmountFieldSchema,
    taskIdByPeriod: z.record(z.string(), z.string()),
    accountingPeriod: accountingPeriodFieldSchema.optional(),
});

const taskCompletionSalaryConfigResponseSchema = z.discriminatedUnion('isRecurring', [
    taskCompletionOneOffConfigResponseSchema,
    taskCompletionRecurringConfigResponseSchema,
]);

export type TaskCompletionSalaryConfigResponse = z.infer<
    typeof taskCompletionSalaryConfigResponseSchema
>;

const taskCompletionSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('TaskCompletion'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: taskCompletionSalaryConfigRequestSchema,
});

// ================= Уровень отдела/направления (add-department-head-salary-rules) ================= //
//
// Implements FR1-FR4 of add-department-head-salary-rules.
//
// Три новых вида правила уровня отдела/направления (design.md Decision 2) — в отличие от
// PayPerHour/ServiceCompleted/OrderPayed/TaskCompletion выше, они НЕ итерируют транзакции и не
// матчат роль сотрудника по заказу: всегда считаются целиком на того единственного сотрудника,
// кому назначена схема правила (targetType = 'Employee', design.md Decision 1). `targetRole`
// сохраняется на форме правила ради консистентности схемы/каталога ролей в UI, но не участвует в
// самой логике расчёта.
//
// category: string | null — тот же scope-параметр, что и у ProductSoldEntity.config.category
// (null = без фильтра, «весь склад/направление»). department, с которым резолвится
// SalesPerformance для DepartmentPercent/DepartmentPlanBonus, по умолчанию берётся из собственного
// BitrixEmployee.departmentId сотрудника, которому назначено правило (design.md Decision 1,
// findEmployeeDepartmentId). departmentId в конфиге ниже — временный костыль поверх этого решения:
// явное переопределение отдела, из плана которого резолвится SalesPerformance, для случаев, когда у
// собственного отдела сотрудника ещё нет плана продаж (например, только что созданный отдел) —
// null/не задано сохраняет исходное поведение (свой отдел).
// .optional() (не .default()) — иначе z.infer сделал бы поле обязательным в выводном типе и сломал
// компиляцию всех мест, где config этих двух правил уже собирается литералом без него (фабрики,
// тесты); undefined трактуется правилом (department-percent.entity.ts/department-plan-bonus.entity.ts,
// resolveEntry()) как отсутствие override — так же, как null.
const departmentIdOverrideSchema = z.number().nullable().optional();

// DepartmentPercent (FR2) — % от факта выручки/маржи отдела/категории/направления, без какого-либо
// коэффициента (простой фиксированный процент от фактического значения плана продаж за период):
// amount = round(fact.(turnover|margin) * percent / 100).
const departmentPercentSalaryConfigSchema = z.object({
    salaryBasis: salaryBasisSchema,
    category: z.string().nullable(),
    percent: z.number(),
    departmentId: departmentIdOverrideSchema,
});

export type DepartmentPercentSalaryConfig = z.infer<
    typeof departmentPercentSalaryConfigSchema
>;

const departmentPercentSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('DepartmentPercent'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: departmentPercentSalaryConfigSchema,
});

// DepartmentPlanBonus (FR3) — фиксированная сумма × плавающий коэффициент выполнения плана продаж
// по выручке/марже (по категории или по всему направлению), переиспользует уже существующий
// percentBorders/resolveFloatPercentMultiplier и уже существующий SalesPerformance.percentCompletion:
// amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders, percentCompletion)).
const departmentPlanBonusSalaryConfigSchema = z.object({
    salaryBasis: salaryBasisSchema,
    category: z.string().nullable(),
    fixedAmount: z.number(),
    percentBorders: percentBordersSchema,
    departmentId: departmentIdOverrideSchema,
});

export type DepartmentPlanBonusSalaryConfig = z.infer<
    typeof departmentPlanBonusSalaryConfigSchema
>;

const departmentPlanBonusSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('DepartmentPlanBonus'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: departmentPlanBonusSalaryConfigSchema,
});

// DepartmentTurnoverBonus (FR4) — фиксированная сумма × плавающий коэффициент выполнения плана по
// коэффициенту оборачиваемости, привязанный к конкретному СКЛАДУ (warehouseId — обязательное поле:
// оборачиваемость скоуплена по категории × складу, автоматической привязки сотрудник→склад в
// системе нет, в отличие от отдела, design.md Decision 1) и опционально к category внутри него
// (null — итог по всему складу, см. GoodsTurnoverWarehouseTotal, FR5). planTurnoverRatio хранится
// прямо в конфигурации самого правила, а не как отдельная сущность/справочник плана:
// amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders,
//   (factTurnoverRatio / planTurnoverRatio) * 100)).
// warehouseId — number для service (RoApp/RemOnline warehouse id, см. warehouseSchema в
// goods-turnover-report.ts); зеркальная shop-схема (shop-salary-rule.ts) использует string
// (MoySklad UUID, см. shopGoodsTurnoverReportLineSchema.warehouseId).
const departmentTurnoverBonusSalaryConfigSchema = z.object({
    warehouseId: z.number(),
    category: z.string().nullable(),
    fixedAmount: z.number(),
    planTurnoverRatio: z.number(),
    percentBorders: percentBordersSchema,
});

export type DepartmentTurnoverBonusSalaryConfig = z.infer<
    typeof departmentTurnoverBonusSalaryConfigSchema
>;

const departmentTurnoverBonusSalaryRuleSchema = z.object({
    id: z.string().optional(),
    type: z.literal('DepartmentTurnoverBonus'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: departmentTurnoverBonusSalaryConfigSchema,
});

const salaryRuleRequestSchema = z.discriminatedUnion('type', [
    payPerHourSalaryRuleSchema,
    serviceCompletedSalaryRuleSchema,
    orderPayedSalaryRuleSchema,
    taskCompletionSalaryRuleSchema,
    departmentPercentSalaryRuleSchema,
    departmentPlanBonusSalaryRuleSchema,
    departmentTurnoverBonusSalaryRuleSchema,
]);

export type SalaryRuleRequest = z.infer<typeof salaryRuleRequestSchema>;

// ========================== Ответ с id правила ========================== //

// Форма GET .../motivation-schema/:id (детальная схема с уже существующими
// правилами, для предзаполнения формы редактирования) — та же форма, что и
// salaryRuleRequestSchema, плюс id (правило уже персистентно). Каждый
// вариант расширяется отдельно (.extend на самой union-схеме zod не
// поддерживает), чтобы `type` остался дискриминантом.
// isActive — soft-деактивация правила (правило перестаёт участвовать в
// расчётах и пропадает из ответа GET .../motivation-schema/:id, но не
// удаляется физически, см. deactivate-salary-rule.command.ts на бэкенде).
// Только ответ — клиент никогда не отправляет это поле, переключение только
// через отдельные эндпоинты .../salary-rules/:ruleId/deactivate|activate, не
// через PATCH схемы.
const payPerHourSalaryRuleResponseSchema = payPerHourSalaryRuleSchema.extend({
    id: z.string(),
    isActive: z.boolean(),
});
const serviceCompletedSalaryRuleResponseSchema =
    serviceCompletedSalaryRuleSchema.extend({
        id: z.string(),
        isActive: z.boolean(),
    });
const orderPayedSalaryRuleResponseSchema = orderPayedSalaryRuleSchema.extend({
    id: z.string(),
    isActive: z.boolean(),
});
// Не taskCompletionSalaryRuleSchema.extend({ id }) — config различается между запросом и ответом
// (taskId vs taskIdByPeriod, см. taskCompletionSalaryConfigResponseSchema выше), поэтому вся форма
// строится заново с config-схемой ответа, а не расширяется поверх request-схемы.
const taskCompletionSalaryRuleResponseSchema = z.object({
    id: z.string(),
    type: z.literal('TaskCompletion'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: taskCompletionSalaryConfigResponseSchema,
    isActive: z.boolean(),
});

// 3 новых вида правила уровня отдела/направления (add-department-head-salary-rules, FR2-FR4) —
// config одинаков между запросом и ответом (в отличие от TaskCompletion), поэтому просто .extend({ id }).
const departmentPercentSalaryRuleResponseSchema =
    departmentPercentSalaryRuleSchema.extend({ id: z.string() });
const departmentPlanBonusSalaryRuleResponseSchema =
    departmentPlanBonusSalaryRuleSchema.extend({ id: z.string() });
const departmentTurnoverBonusSalaryRuleResponseSchema =
    departmentTurnoverBonusSalaryRuleSchema.extend({ id: z.string() });

const salaryRuleResponseSchema = z.discriminatedUnion('type', [
    payPerHourSalaryRuleResponseSchema,
    serviceCompletedSalaryRuleResponseSchema,
    orderPayedSalaryRuleResponseSchema,
    taskCompletionSalaryRuleResponseSchema,
    departmentPercentSalaryRuleResponseSchema,
    departmentPlanBonusSalaryRuleResponseSchema,
    departmentTurnoverBonusSalaryRuleResponseSchema,
]);

export type SalaryRuleResponse = z.infer<typeof salaryRuleResponseSchema>;

// ========================== Сводка правила для карточки задачи ========================== //

// Сводка зарплатного правила «за выполнение задачи», отображаемая в блоке `ERP/Organism/Task Rule
// Card` на карточке задачи (add-task-salary-rule-links-comments, architecture.md, Method Signatures:
// `FindSalaryRuleForTaskService.execute`) — не полная форма правила (`salaryRuleResponseSchema`),
// только то, что нужно карточке: иконка по типу, название, роль в мета-строке. id — правила, тот же,
// что и `SalaryRuleDetail.id` ниже, чтобы клик по карточке открывал боковую панель
// `features/SalaryRuleDetailsPanel` (`GetSalaryRuleService`/`useSalaryRule(ruleId, direction)`) с
// полным описанием.
const salaryRuleSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    targetRole: targetRoleSchema,
});

export type SalaryRuleSummary = z.infer<typeof salaryRuleSummarySchema>;

// ========================== Детальное описание правила (боковая панель) ========================== //

// Для read-only боковой панели `features/SalaryRuleDetailsPanel` (design.md решение 5,
// `GetSalaryRuleService.execute`) — та же форма, что у вариантов `salaryRuleResponseSchema` выше
// (id/type/name/targetRole/config, различающиеся по типу правила — «параметры» из proposal.md),
// плюс: direction — панель открывается из карточки задачи и может относиться к любому направлению,
// вызывающий код не обязан знать его заранее (в отличие от salaryRuleResponseSchema, читаемого внутри
// уже известного направления); motivationSchemaName — название мотивационной схемы, к которой
// относится правило (architecture.md, Method Signatures: «уточнено по итогам ui-design.md», ui-design.md
// «Отклонения от architecture.md» п.1 — панель показывает «Инженеры · Сервис»). Каждый вариант
// расширяется отдельно, как и у salaryRuleResponseSchema (`.extend` на union недоступен, `type` должен
// остаться дискриминантом).
const payPerHourSalaryRuleDetailSchema = payPerHourSalaryRuleResponseSchema.extend({
    direction: salesDirectionSchema,
    motivationSchemaName: z.string(),
});
const serviceCompletedSalaryRuleDetailSchema =
    serviceCompletedSalaryRuleResponseSchema.extend({
        direction: salesDirectionSchema,
        motivationSchemaName: z.string(),
    });
const orderPayedSalaryRuleDetailSchema = orderPayedSalaryRuleResponseSchema.extend({
    direction: salesDirectionSchema,
    motivationSchemaName: z.string(),
});
const taskCompletionSalaryRuleDetailSchema =
    taskCompletionSalaryRuleResponseSchema.extend({
        direction: salesDirectionSchema,
        motivationSchemaName: z.string(),
    });

const salaryRuleDetailSchema = z.discriminatedUnion('type', [
    payPerHourSalaryRuleDetailSchema,
    serviceCompletedSalaryRuleDetailSchema,
    orderPayedSalaryRuleDetailSchema,
    taskCompletionSalaryRuleDetailSchema,
]);

export type SalaryRuleDetail = z.infer<typeof salaryRuleDetailSchema>;

// ========================== Список типов правил для UI ========================== //

// Ответ GET /accounting/salary_role_types (Фаза 8, "Когда готово" плана) —
// каждый тип правила плюс перечень допустимых для него ролей, чтобы форма
// на фронтенде подставляла варианты targetRole только из этого набора (см.
// PRD, раздел 2: "в список типов правил, отдаваемый фронтенду, входит
// перечень допустимых ролей").
const salaryRuleTypeInfoSchema = z.object({
    type: z.string(),
    allowedRoles: z.array(targetRoleSchema),
});

const salaryRuleTypesResponseSchema = z.array(salaryRuleTypeInfoSchema);

export type SalaryRuleTypeInfo = z.infer<typeof salaryRuleTypeInfoSchema>;
export type SalaryRuleTypesResponse = z.infer<
    typeof salaryRuleTypesResponseSchema
>;

// ========================== Строка расчёта ========================== //

// Результат calculate() одного правила за один проход (один режим — FACT
// либо PROGNOSE) — не число, а строка расчёта: правило, база начисления,
// количество, ставка, сумма, ссылки на источники (заказы/позиции/продажи),
// на которых она получена. Форма едина для service и shop (зеркало
// src/shared/domain/calculation-line.ts на бэкенде — там это внутренний
// доменный тип, здесь — его сериализуемая форма).
//
// label/link/amount — опциональное обогащение источника (не у всех типов
// источников есть: например, у 'taskCompletion' сегодня нет ни
// человекочитаемого номера документа, ни ссылки в ERP; у 'demandPosition'
// оба поля есть — см. ProductSoldEntity/UsedProductSoldEntity), поэтому
// optional, а не часть базовой формы {type, id}. amount — сумма начисления,
// приходящаяся на этот конкретный источник В РЕЖИМЕ текущей строки (FACT
// либо PROGNOSE, см. calculationLineSchema.amount), а не персональная доля
// от округлённой суммы всего правила. Опционально и здесь — уже закрытые
// периоды/сохранённые документы начисления могли зафиксировать sources[] до
// того, как это поле появилось (снапшот/документ — неизменяемый JSON,
// заново не пересчитывается), фронт для таких строк просто не показывает
// сумму/ссылку, как и раньше.
const calculationSourceRefSchema = z.object({
    type: z.string(),
    id: z.union([z.string(), z.number()]),
    label: z.string().optional(),
    link: z.string().optional(),
    amount: z.number().optional(),
    // Наименование модели устройства и его неисправность — заполняются
    // только там, где источник — заказ/позиция заказа RemOnline (см.
    // label/link выше), для остальных типов источников отсутствуют.
    brand: z.string().optional(),
    deviceModel: z.string().optional(),
    deviceColor: z.string().optional(),
    malfunction: z.string().optional(),
    // Название конкретного проданного товара/оказанной услуги
    // (RoappService.name / MoySkladDemandPosition.assortmentName) —
    // заполняется только там, где источник умеет его определить.
    itemName: z.string().optional(),
});

const calculationLineSchema = z.object({
    ruleId: z.string(),
    salaryBasis: z.string().optional(),
    quantity: z.number().optional(),
    rate: z.number().optional(),
    amount: z.number(),
    sources: z.array(calculationSourceRefSchema),
});

export type CalculationLineResponse = z.infer<typeof calculationLineSchema>;

// ========================== Отчёт по зарплате сотрудника ========================== //

// Пара «факт / прогноз» — отчёт всегда считает calculate() дважды (режимы
// FACT и PROGNOSE) и сводит строки по ruleId; отдельной ветки под прогноз
// нет (см. PRD, раздел 6). prognose nullable — у закрытого периода снапшот
// прогноза не хранит, поле остаётся пустым, а не равным факту (Фаза 9, см.
// PRD раздел 6: "У закрытого периода поля prognose не заполняются").
const factPrognoseAmountSchema = z.object({
    fact: z.number(),
    prognose: z.number().nullable(),
});

export type FactPrognoseAmount = z.infer<typeof factPrognoseAmountSchema>;

const salesPerformanceSummarySchema = z.object({
    department: z.number(),
    category: z.string().nullable(),
    plan: z.object({ turnover: z.number(), margin: z.number() }),
    fact: z.object({ turnover: z.number(), margin: z.number() }),
    prognose: z.object({ turnover: z.number(), margin: z.number() }),
    percentCompletion: z.number(),
});

export type SalesPerformanceSummary = z.infer<
    typeof salesPerformanceSummarySchema
>;

// Текущий/следующий порог FloatPercent и разница до следующего (в обороте,
// см. PRD раздел 6: "чтобы UI мог показать «до следующего порога осталось N
// по обороту»"). currentThreshold/nextThreshold — null, когда процент
// выполнения плана ниже самого нижнего порога (currentThreshold) либо уже
// достиг/превысил старший порог (nextThreshold, "порогов выше нет").
const floatPercentInfoSchema = z.object({
    currentThreshold: percentBorderSchema.nullable(),
    nextThreshold: percentBorderSchema.nullable(),
    diffToNext: z.number().nullable(),
});

export type FloatPercentInfo = z.infer<typeof floatPercentInfoSchema>;

// Источник строки в ответе отчёта — та же форма, что и calculationSourceRefSchema,
// но amount сведён по паре ФАКТ/ПРОГНОЗ (см. employeeSalaryReportRuleSchema.amount
// ниже) — отчёт считает calculate() дважды (FACT и PROGNOSE) и сопоставляет
// источники между двумя проходами по позиции (один и тот же список
// ERP-объектов в обоих режимах — отличается только сумма, посчитанная на
// каждый). Optional — сумма источника не заполняется у закрытого периода
// (снапшот прогноза не хранит, см. factPrognoseAmountSchema) и у источников,
// сохранённых до появления этого поля (см. calculationSourceRefSchema).
const employeeSalaryReportSourceSchema = z.object({
    type: z.string(),
    id: z.union([z.string(), z.number()]),
    label: z.string().optional(),
    link: z.string().optional(),
    amount: factPrognoseAmountSchema.optional(),
    // Наименование модели устройства и его неисправность (см.
    // calculationSourceRefSchema) — то же обогащение, что и там.
    brand: z.string().optional(),
    deviceModel: z.string().optional(),
    deviceColor: z.string().optional(),
    malfunction: z.string().optional(),
    // Название конкретного проданного товара/оказанной услуги
    // (RoappService.name / MoySkladDemandPosition.assortmentName) —
    // заполняется только там, где источник умеет его определить.
    itemName: z.string().optional(),
});

export type EmployeeSalaryReportSource = z.infer<
    typeof employeeSalaryReportSourceSchema
>;

// Разбивка по правилу в отчёте — это calculationLineSchema, сведённый по
// парам FACT/PROGNOSE, плюс атрибуты правила (type/name/targetRole), нужные
// UI для отображения без дополнительных запросов. floatPercent — только для
// правил с award.type === 'FloatPercent' и только пока для периода известен
// SalesPerformance (иначе отсутствует, как и amount.prognose у закрытого
// периода).
const employeeSalaryReportRuleSchema = z.object({
    ruleId: z.string(),
    type: z.string(),
    name: z.string(),
    targetRole: targetRoleSchema,
    amount: factPrognoseAmountSchema,
    appliedPercent: z.number().optional(),
    floatPercent: z
        .object({
            fact: floatPercentInfoSchema,
            prognose: floatPercentInfoSchema,
        })
        .optional(),
    sources: z.array(employeeSalaryReportSourceSchema),
});

export type EmployeeSalaryReportRule = z.infer<
    typeof employeeSalaryReportRuleSchema
>;

// isClosed — своё у каждого направления (Фаза 13.5), а не одно общее на
// весь ответ: service и shop закрываются независимо
// (AccountingPeriod.direction — часть ключа), поэтому статус закрытия —
// свойство направления. У закрытого направления total.prognose — null (см.
// factPrognoseAmountSchema), у открытого — посчитан заново/из кэша.
const directionSalaryReportSchema = z.object({
    direction: z.enum(['service', 'shop']),
    isClosed: z.boolean(),
    total: factPrognoseAmountSchema,
    rules: z.array(employeeSalaryReportRuleSchema),
    // Одна строка на каждую отдельную строку плана отдела за период — у
    // service это всегда 0 или 1 элемент (план всегда один, без разбивки по
    // категориям), у shop может быть несколько (план magazина ведётся
    // по категориям МойСклад, см. GetShopEmployeeSalaryReportService) — UI
    // рендерит одну карточку "План продаж · <направление>" с одной строкой
    // прогресса на каждый элемент массива. Пустой массив — плана ещё нет
    // (Фаза 5, модуль sales/SalesPerformance) — до этого момента у
    // направления ещё нет ни плана, ни факта продаж.
    salesPerformance: z.array(salesPerformanceSummarySchema),
    isPlanApproved: z.boolean(),
    // Статус документа начисления сотрудника за закрытый период (PRD 1
    // docs/payroll-closing-and-accrual: "ожидает начисление / начислено /
    // выплачено"): null — период открыт либо документа у сотрудника нет
    // (в снапшот не попал).
    accrualStatus: salaryAccrualStatusSchema.nullable(),
});

// Ответ односторонний: один отчёт одного направления сотрудника за период,
// а не сводка по обоим направлениям сразу (было directions[] + grandTotal,
// см. историю Фазы 13.5) — за выбор direction и объединение с другим
// направлением (если понадобится) отвечает вызывающий бэкенд-код, а не этот
// контракт. Поэтому форма — просто period поверх directionSalaryReportSchema,
// без обёртки массивом и без сводного grandTotal.
const employeeSalaryReportResponseSchema = z
    .object({ period: z.string() })
    .merge(directionSalaryReportSchema);

export type EmployeeSalaryReportResponse = z.infer<
    typeof employeeSalaryReportResponseSchema
>;

// ========================== Отчёт по зарплатам отдела ========================== //

// GET /accounting/salary_report/department/:id/:period (Фаза 9) — тот же
// расчёт, что и у отчёта сотрудника (см. PeriodCalculationOrchestrator +
// buildSalaryReportRules на бэкенде), агрегированный по всем сотрудникам
// отдела: по каждому — общая сумма и разбивка по его зарплатным правилам,
// сверху — итог по отделу. Отдельной "свёрнутой" логики расчёта для отдела
// нет — total равен сумме employees[].total (см. PRD раздел 6 и план,
// Фаза 9).
const departmentSalaryReportEmployeeSchema = z.object({
    employeeId: z.number(),
    name: z.string(),
    total: factPrognoseAmountSchema,
    rules: z.array(employeeSalaryReportRuleSchema),
});

export type DepartmentSalaryReportEmployee = z.infer<
    typeof departmentSalaryReportEmployeeSchema
>;

const departmentSalaryReportResponseSchema = z.object({
    period: z.string(),
    isClosed: z.boolean(),
    department: z.number(),
    employees: z.array(departmentSalaryReportEmployeeSchema),
    total: factPrognoseAmountSchema,
});

export type DepartmentSalaryReportResponse = z.infer<
    typeof departmentSalaryReportResponseSchema
>;

export {
    salaryRuleRequestSchema,
    payPerHourSalaryConfigSchema,
    serviceCompletedSalaryConfigSchema,
    orderPayedSalaryConfigSchema,
    taskCompletionSalaryConfigRequestSchema,
    taskCompletionSalaryConfigResponseSchema,
    taskLinkTemplateSchema,
    departmentPercentSalaryConfigSchema,
    departmentPlanBonusSalaryConfigSchema,
    departmentTurnoverBonusSalaryConfigSchema,
    percentBorderSchema,
    percentBordersSchema,
    salaryBasisSchema,
    targetRoleSchema,
    calculationLineSchema,
    factPrognoseAmountSchema,
    salesPerformanceSummarySchema,
    floatPercentInfoSchema,
    employeeSalaryReportSourceSchema,
    employeeSalaryReportRuleSchema,
    employeeSalaryReportResponseSchema,
    departmentSalaryReportEmployeeSchema,
    departmentSalaryReportResponseSchema,
    salaryRuleTypeInfoSchema,
    salaryRuleTypesResponseSchema,
    salaryRuleResponseSchema,
    salaryRuleSummarySchema,
    salaryRuleDetailSchema,
};
