import { z } from 'zod';
import { salaryAccrualStatusSchema } from './salary-accrual-status';
import { periodSchema } from './sales-plan';

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
// как и OFFICE, намеренно не входит — остальные три типа правил сервиса
// (ServiceCompleted/OrderPayed/TaskCompleted) матчат сотрудника через
// service-role-source.ts, где у неё нет собственного поля ERP.
const targetRoleSchema = z.enum([
    'ENGINEER',
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
    'ORDER_MANAGER',
    'ONLINE_PURCHASER',
    'OFFLINE_PURCHASER',
    'OFFICE',
    'SOLO_MANAGER',
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
// mode лежит на каждом пороге отдельно (а не одним полем на весь award) —
// так задан контракт в PRD ("каждый — { fromPlanPercent, multiplier, mode }");
// смысл: mode описывает, что происходит НА ЭТОМ пороге и ДАЛЬШЕ, вплоть до
// следующего порога (или до бесконечности, если порог последний по
// fromPlanPercent):
// - FIX    — множитель ступенькой: от этого порога и до следующего действует
//            множитель ЭТОГО порога;
// - LINEAR — от этого порога до следующего множитель линейно
//            интерполируется между множителем этого порога и множителем
//            следующего.
// См. domain/services/float-percent.ts на бэкенде (в обоих доменах —
// service и shop, это независимые, но идентичные по семантике реализации).
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
    type: z.literal('OrderPayed'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: orderPayedSalaryConfigSchema,
});

// ========================== За выполненную задачу ========================== //

// "Задача" здесь — реальная задача Bitrix24, привязанная к правилу
// (change salary-rule-bitrix-task, взамен временного внутреннего
// воркфлоу TaskCompletion — контракт удалён этим же change). Постановка, обсуждение и
// приёмка идут в Bitrix24; iReports хранит только bitrixTaskIds
// (см. ниже) и по ним читает статус/расчётный месяц задачи пакетным
// запросом при расчёте (design.md, Decision 1) — расчётный месяц задачи
// НЕ дублируется здесь: `period` ниже — это только расчётный месяц,
// выбранный руководителем при создании/редактировании правила (для
// валидации dueDate и для тега созданной Bitrix-задачи), а не текущий
// расчётный месяц, который правило обслуживает в моменте (тот определяется
// живым тегом Bitrix24, см. design.md, Decision 1 и 7).
//
// Единственный вид вознаграждения — фиксированная сумма (design.md,
// Decision 2; BREAKING — вариант FloatPercent удалён вместе с award-union,
// см. proposal.md).
const taskCompletedActualAmountEntrySchema = z.object({
    period: periodSchema,
    amount: z.number().min(0),
});

export type TaskCompletedActualAmountEntry = z.infer<
    typeof taskCompletedActualAmountEntrySchema
>;

// Дедлайн — календарный день без времени/часового пояса, строкой (не
// z.coerce.date(): та же причина, что у scheduleDateSchema в
// work-schedule.ts — сериализация OpenAPI и «дедлайн 5 августа» не должен
// уезжать на сутки при смене часового пояса).
const taskCompletedDueDateSchema = z
    .string()
    .regex(
        /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
        'Дедлайн должен быть в формате YYYY-MM-DD',
    );

// Последний календарный день месяца period (YYYY-MM) — используется только
// для проверки границ dueDate ниже (design.md, Decision 9).
function lastDayOfPeriod(period: string): number {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month, 0).getDate();
}

// Жизненный цикл разового правила-задачи
// (docs/task-rule-archiving-and-links, Фаза 1) — имеет смысл только при
// isRecurring: false; для регулярных правил не используется и не
// проверяется. ACTIVE — правило ещё часть мотивационной схемы; ARCHIVED —
// необратимый терминал, правило переводится сюда автоматически при
// закрытии расчётного периода, к которому относится dueDate (backend:
// TaskCompletedEntity.archive()). Не заполняется клиентом — сервер
// проставляет ACTIVE по умолчанию и ARCHIVED только сам, см. дефолт ниже.
const taskCompletedRuleStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export type TaskCompletedRuleStatus = z.infer<
    typeof taskCompletedRuleStatusSchema
>;

const taskCompletedSalaryConfigSchema = z
    .object({
        description: z.string().min(1),
        // Расчётный месяц правила на момент создания/редактирования —
        // границы, в которых обязан лежать dueDate (design.md, Decision 9).
        period: periodSchema,
        isRecurring: z.boolean(),
        dueDate: taskCompletedDueDateSchema,
        rewardAmount: z.number().nonnegative(),
        // ID задач Bitrix24, накопленные за всё время правила — один
        // элемент для разового правила, по одному новому элементу на
        // каждый регенерированный месяц регулярного (design.md, Decision 1).
        // Не заполняется клиентом — проставляется сервером после
        // createTask, поэтому опционален с дефолтом.
        bitrixTaskIds: z.array(z.number().int().positive()).optional(),
        // Фактическая сумма к выплате по закрытой задаче, по одной записи
        // на период (design.md, Decision 2). Не заполняется клиентом при
        // создании/редактировании правила — пишется отдельным контрактом
        // (см. setTaskRuleActualAmountRequestSchema).
        actualAmounts: z.array(taskCompletedActualAmountEntrySchema).optional(),
        status: taskCompletedRuleStatusSchema.default('ACTIVE'),
    })
    .superRefine((config, ctx) => {
        const minDate = `${config.period}-01`;
        const maxDate = `${config.period}-${String(
            lastDayOfPeriod(config.period),
        ).padStart(2, '0')}`;
        if (config.dueDate < minDate || config.dueDate > maxDate) {
            ctx.addIssue({
                code: 'custom',
                path: ['dueDate'],
                message:
                    'Дедлайн должен находиться в пределах выбранного расчётного месяца правила',
            });
        }
    });

const taskCompletedSalaryRuleSchema = z.object({
    type: z.literal('TaskCompleted'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: taskCompletedSalaryConfigSchema,
});

// Бизнес-статус задачи Bitrix24, привязанной к правилу-задаче (design.md,
// Decision 6) — прямое соответствие нативным статусам задач Bitrix24 Tasks:
// PENDING = "Ждёт выполнения" (Создана), IN_PROGRESS = "Выполняется"
// (Реализована), COMPLETED = "Завершена" (Закрыта). Отсутствует
// (не заполнен), когда правило помечено isTaskUnavailable (см.
// employeeSalaryReportRuleSchema ниже) — статус недоступной задачи не
// определён.
const taskRuleStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']);

export type TaskRuleStatus = z.infer<typeof taskRuleStatusSchema>;

// PUT/PATCH ручного ввода фактической суммы по закрытой задаче правила
// (spec.md, "Ручной ввод фактической суммы по закрытой задаче") — доступно
// только на странице зарплатного отчёта сотрудника за открытый период, для
// правила-задачи в статусе "Закрыта" (проверяется на бэкенде, не здесь).
// actualAmount >= 0 — верхняя граница (сумма правила) не известна на уровне
// контракта (сумма правила не передаётся в этом запросе, читается сервером
// по ruleId) и проверяется в домене/application-хендлере.
const setTaskRuleActualAmountRequestSchema = z.object({
    ruleId: z.string(),
    period: periodSchema,
    actualAmount: z.number().min(0),
});

export type SetTaskRuleActualAmountRequest = z.infer<
    typeof setTaskRuleActualAmountRequestSchema
>;

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
// bitrixTaskUrl — ссылка на ТЕКУЩУЮ (последнюю добавленную) задачу
// правила в Bitrix24 (spec.md, "Ссылка на задачу Bitrix24"); строится на
// бэкенде из config.bitrixTaskIds (портал Bitrix24 — конфигурация
// бэкенда, не должна утекать во фронтенд, см. change salary-rule-bitrix-task).
// undefined, если у правила ещё нет ни одной задачи.
const taskCompletedSalaryRuleResponseSchema =
    taskCompletedSalaryRuleSchema.extend({
        id: z.string(),
        bitrixTaskUrl: z.string().optional(),
    });

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
//
// bitrixTaskUrl/taskStatus/isTaskUnavailable/actualAmount — только для
// правил type === 'TaskCompleted' (spec.md, "Ссылка на задачу Bitrix24",
// "Обработка недоступной задачи", "Ручной ввод фактической суммы по
// закрытой задаче"), поэтому все опциональны на этом общем для всех типов
// правил объекте, а не в отдельной ветке union — тот же приём, что и у
// floatPercent/appliedPercent выше. isTaskUnavailable === true — задача
// удалена/недоступна или расчётный месяц не распознан (design.md, Decision
// 7 и Risks): taskStatus/bitrixTaskUrl в этом случае могут отсутствовать,
// начисления по правилу нет ни в факте, ни в прогнозе (amount = 0/0).
// actualAmount — только когда задача в статусе COMPLETED и руководитель
// уже указал фактическую сумму за этот период.
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
    sources: z.array(employeeSalaryReportSourceSchema),
    bitrixTaskUrl: z.string().optional(),
    taskStatus: taskRuleStatusSchema.optional(),
    isTaskUnavailable: z.boolean().optional(),
    actualAmount: z.number().optional(),
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
    taskCompletedSalaryConfigSchema,
    taskCompletedActualAmountEntrySchema,
    taskCompletedRuleStatusSchema,
    taskRuleStatusSchema,
    setTaskRuleActualAmountRequestSchema,
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
};
