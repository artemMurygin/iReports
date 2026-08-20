import { z } from 'zod';

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
const targetRoleSchema = z.enum([
    'ENGINEER',
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
    'ORDER_MANAGER',
    'ONLINE_PURCHASER',
    'OFFLINE_PURCHASER',
    'OFFICE',
]);

export type TargetRole = z.infer<typeof targetRoleSchema>;

// База начисления процентных правил — общая для OrderPayed и TaskCompleted
// (Фаза 8): REVENUE (выручка заказа), MARGIN (маржа), SALARY_MINUS_ENGINEER_SALARY
// (сумма за вычетом зарплаты инженера). См.
// docs/payroll/prd-payroll-calculation.md, раздел 2.
const salaryBasisSchema = z.enum([
    'REVENUE',
    'MARGIN',
    'SALARY_MINUS_ENGINEER_SALARY',
]);

export type SalaryBasis = z.infer<typeof salaryBasisSchema>;

// Один из трёх порогов FloatPercent — { fromPlanPercent, multiplier, mode }.
// FIX — множитель ступенькой при достижении порога, LINEAR — линейная
// интерполяция между соседними порогами (см. PRD, раздел 2, и план, Фаза 8).
// mode лежит на каждом пороге отдельно (а не одним полем на весь award) —
// так задан контракт в PRD ("каждый — { fromPlanPercent, multiplier, mode }");
// смысл: mode описывает, как считается участок МЕЖДУ предыдущим порогом
// (или нулевой точкой, если это первый порог) и этим — см.
// domain/services/float-percent.ts на бэкенде.
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

const payPerHourSalaryRuleSchema = z.object({
    type: z.literal('PayPerHour'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: payPerHourSalaryConfigSchema,
});

// ========================== За выполненную услугу ========================== //

const serviceCompletedSalaryConfigSchema = z.object({
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({ type: z.literal('ServiceFixed') }),
        z.object({ type: z.literal('ServicePercent'), percent: z.number() }),
    ]),
});

const serviceCompletedSalaryRuleSchema = z.object({
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
});

const orderPayedSalaryRuleSchema = z.object({
    type: z.literal('OrderPayed'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: orderPayedSalaryConfigSchema,
});

// ========================== За выполненную задачу ========================== //

// "Задача" в этой итерации — внутренний ручной ввод (EmployeeTaskCompletion
// на бэкенде), а не интеграция с Bitrix24 Tasks (см. план, Фаза 8, раздел
// "Принятые решения по открытым вопросам" — интеграция с реальными задачами
// Bitrix24 запланирована отдельной фазой). FloatPercent для TaskCompleted —
// не описан в PRD подробно (в отличие от OrderPayed); решение по этому
// открытому вопросу: тот же трёхпороговый механизм percentBorders, что и у
// OrderPayed, но база — не сумма заказа, а фиксированная ставка за
// подтверждённую задачу (basePrice), умножаемая на множитель выполнения
// плана — см. domain/entities/salary-rules/task-completed.entity.ts на
// бэкенде.
const taskCompletedSalaryConfigSchema = z.object({
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({
            type: z.literal('FloatPercent'),
            basePrice: z.number(),
            percentBorders: percentBordersSchema,
        }),
    ]),
});

const taskCompletedSalaryRuleSchema = z.object({
    type: z.literal('TaskCompleted'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: taskCompletedSalaryConfigSchema,
});

const salaryRuleRequestSchema = z.discriminatedUnion('type', [
    payPerHourSalaryRuleSchema,
    serviceCompletedSalaryRuleSchema,
    orderPayedSalaryRuleSchema,
    taskCompletedSalaryRuleSchema,
]);

export type SalaryRuleRequest = z.infer<typeof salaryRuleRequestSchema>;

// ========================== Ответ с id правила ========================== //

// Форма GET .../motivation-schema/:id (детальная схема с уже существующими
// правилами, для предзаполнения формы редактирования) — та же форма, что и
// salaryRuleRequestSchema, плюс id (правило уже персистентно). Каждый
// вариант расширяется отдельно (.extend на самой union-схеме zod не
// поддерживает), чтобы `type` остался дискриминантом.
const payPerHourSalaryRuleResponseSchema = payPerHourSalaryRuleSchema.extend({
    id: z.string(),
});
const serviceCompletedSalaryRuleResponseSchema =
    serviceCompletedSalaryRuleSchema.extend({ id: z.string() });
const orderPayedSalaryRuleResponseSchema = orderPayedSalaryRuleSchema.extend({
    id: z.string(),
});
const taskCompletedSalaryRuleResponseSchema =
    taskCompletedSalaryRuleSchema.extend({ id: z.string() });

const salaryRuleResponseSchema = z.discriminatedUnion('type', [
    payPerHourSalaryRuleResponseSchema,
    serviceCompletedSalaryRuleResponseSchema,
    orderPayedSalaryRuleResponseSchema,
    taskCompletedSalaryRuleResponseSchema,
]);

export type SalaryRuleResponse = z.infer<typeof salaryRuleResponseSchema>;

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
const calculationSourceRefSchema = z.object({
    type: z.string(),
    id: z.union([z.string(), z.number()]),
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
        .object({ fact: floatPercentInfoSchema, prognose: floatPercentInfoSchema })
        .optional(),
    sources: z.array(calculationSourceRefSchema),
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
    // Заполняется начиная с Фазы 5 (модуль sales/SalesPerformance) — до этого
    // момента у направления ещё нет ни плана, ни факта продаж.
    salesPerformance: salesPerformanceSummarySchema.nullable(),
    isPlanApproved: z.boolean(),
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
    taskCompletedSalaryConfigSchema,
    percentBorderSchema,
    percentBordersSchema,
    salaryBasisSchema,
    targetRoleSchema,
    calculationLineSchema,
    factPrognoseAmountSchema,
    salesPerformanceSummarySchema,
    floatPercentInfoSchema,
    employeeSalaryReportRuleSchema,
    employeeSalaryReportResponseSchema,
    departmentSalaryReportEmployeeSchema,
    departmentSalaryReportResponseSchema,
    salaryRuleTypeInfoSchema,
    salaryRuleTypesResponseSchema,
    salaryRuleResponseSchema,
};
