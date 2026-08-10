import { z } from 'zod';

// План продаж — сущность, без которой не считается ни одно процентное
// зарплатное правило (Фаза 3, см. docs/payroll/plan-payroll-calculation.md
// и prd-payroll-calculation.md, раздел "План продаж"). Модели общие для
// направлений service и shop (см. Фазу 11) — направление задаётся полем
// direction на каждой строке, а не отдельными таблицами.

const periodSchema = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Период должен быть в формате YYYY-MM');

// ========================== Направление ========================== //

// Совпадает с AccountingDirection (src/shared/domain/calculation-context.ts
// на бэкенде) — здесь та же пара значений в виде схемы, отдельного общего
// экспорта между этим файлом и salary-rule.ts пока нет (см.
// directionSalaryReportSchema), дублирование минимально и по значениям, а
// не по смыслу.
const salesDirectionSchema = z.enum(['service', 'shop']);
export type SalesDirection = z.infer<typeof salesDirectionSchema>;

// ========================== SalesPlanTemplate ========================== //

// Дефолтные значения плана по отделу и, опционально, категории — стартовая
// точка для самого первого месяца направления и запасной вариант, если
// плана за предыдущий месяц ещё нет (Фаза 4). category = null — шаблон
// действует на отдел целиком.
const salesPlanTemplateSchema = z.object({
    id: z.string(),
    direction: salesDirectionSchema,
    department: z.number(),
    category: z.number().nullable(),
    turnover: z.number(),
    margin: z.number(),
    growthPercent: z.number(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export type SalesPlanTemplateResponse = z.infer<typeof salesPlanTemplateSchema>;

// PUT — правка шаблона: чтение и запись всегда идут по естественному ключу
// (direction, department, category), отдельного POST на создание строки
// шаблона нет — первая правка комбинации создаёт её (см.
// PutSalesPlanTemplateHandler).
const putSalesPlanTemplateRequestSchema = z.object({
    direction: salesDirectionSchema,
    department: z.number(),
    category: z.number().nullable().optional(),
    turnover: z.number().nonnegative(),
    margin: z.number(),
    growthPercent: z.number().nonnegative(),
});
export type PutSalesPlanTemplateRequest = z.infer<
    typeof putSalesPlanTemplateRequestSchema
>;

const listSalesPlanTemplatesQuerySchema = z.object({
    direction: salesDirectionSchema.optional(),
});
export type ListSalesPlanTemplatesQuery = z.infer<
    typeof listSalesPlanTemplatesQuerySchema
>;

// ========================== SalesPlan ========================== //

// PREVIOUS_MONTH/TEMPLATE — источники, которыми крон и ленивое достраивание
// заполняют месяц без участия руководителя (Фаза 4); MANUAL — ручное
// создание (этот модуль) или правка уже существующей строки — любая правка
// переводит источник в MANUAL, каким бы он ни был раньше.
const salesPlanSourceSchema = z.enum([
    'PREVIOUS_MONTH',
    'TEMPLATE',
    'MANUAL',
]);
export type SalesPlanSource = z.infer<typeof salesPlanSourceSchema>;

// CREATED — строка полноценно участвует в расчётах, но ещё не подтверждена
// руководителем; APPROVED — подтверждена. Автоматически APPROVED никогда не
// проставляется.
const salesPlanStatusSchema = z.enum(['CREATED', 'APPROVED']);
export type SalesPlanStatus = z.infer<typeof salesPlanStatusSchema>;

const salesPlanSchema = z.object({
    id: z.string(),
    direction: salesDirectionSchema,
    department: z.number(),
    category: z.number().nullable(),
    period: periodSchema,
    turnover: z.number(),
    margin: z.number(),
    source: salesPlanSourceSchema,
    status: salesPlanStatusSchema,
    approvedBy: z.number().nullable(),
    approvedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export type SalesPlanResponse = z.infer<typeof salesPlanSchema>;

// Создание — всегда ручное (source = MANUAL на бэкенде, здесь не
// запрашивается): автоматические источники (PREVIOUS_MONTH/TEMPLATE)
// проставляет только крон/ленивое достраивание Фазы 4, у этого эндпоинта их
// не бывает. Повторное создание на ту же комбинацию
// (direction, department, category, period) отклоняется.
const createSalesPlanRequestSchema = z.object({
    direction: salesDirectionSchema,
    department: z.number(),
    category: z.number().nullable().optional(),
    period: periodSchema,
    turnover: z.number().nonnegative(),
    margin: z.number(),
});
export type CreateSalesPlanRequest = z.infer<
    typeof createSalesPlanRequestSchema
>;

// Правка значений — direction/department/category/period неизменны (это
// была бы уже другая строка); правка переводит source в MANUAL и сбрасывает
// status в CREATED, если строка была утверждена.
const updateSalesPlanRequestSchema = z
    .object({
        turnover: z.number().nonnegative().optional(),
        margin: z.number().optional(),
    })
    .refine((data) => data.turnover !== undefined || data.margin !== undefined, {
        message: 'Нужно указать turnover и/или margin',
    });
export type UpdateSalesPlanRequest = z.infer<
    typeof updateSalesPlanRequestSchema
>;

// Утверждение построчно (ids) или массово по направлению и месяцу
// (direction + period, все строки CREATED переходят в APPROVED, уже
// утверждённые строки не трогаются). approvedBy — Bitrix ID руководителя,
// который утверждает: в проекте нет модели прав и резолва "текущего
// пользователя" вне PortalAdminGuard (см. backend/CLAUDE.md), поэтому его
// передаёт фронтенд явно, а не берёт из токена/сессии.
const approveSalesPlanRequestSchema = z.union([
    z.object({ ids: z.array(z.string()).min(1), approvedBy: z.number() }),
    z.object({
        direction: salesDirectionSchema,
        period: periodSchema,
        approvedBy: z.number(),
    }),
]);
export type ApproveSalesPlanRequest = z.infer<
    typeof approveSalesPlanRequestSchema
>;

const listSalesPlansQuerySchema = z.object({
    direction: salesDirectionSchema,
    period: periodSchema,
});
export type ListSalesPlansQuery = z.infer<typeof listSalesPlansQuerySchema>;

export {
    salesDirectionSchema,
    salesPlanTemplateSchema,
    putSalesPlanTemplateRequestSchema,
    listSalesPlanTemplatesQuerySchema,
    salesPlanSourceSchema,
    salesPlanStatusSchema,
    salesPlanSchema,
    createSalesPlanRequestSchema,
    updateSalesPlanRequestSchema,
    approveSalesPlanRequestSchema,
    listSalesPlansQuerySchema,
};
