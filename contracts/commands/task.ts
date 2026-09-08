import { z } from 'zod';
import { isoDateStringSchema } from './employee-balance';

// Задача — полностью доменно-агностичная сущность iReports (replace-bitrix-task-integration,
// design.md решения 2/3, specs/tasks/spec.md). Общая для всех направлений (`service`/`shop`),
// создаётся и живёт полностью внутри iReports, без обращения к какой-либо внешней системе (замена
// Bitrix24 Tasks-интеграции) и БЕЗ знания о зарплатных правилах, отчётах или конкретном направлении
// бизнеса — связь «правило ↔ задача» хранит и обслуживает само зарплатное правило
// (`TaskCompletionSalaryConfig.taskIdByPeriod`, см. ./salary-rule и ./shop-salary-rule), не задача.

// ========================== Направление (тег происхождения) ========================== //

// Необязательный тег для фильтрации в общем списке `/tasks` — НЕ дискриминатор доступа и НЕ связь
// с зарплатным правилом (design.md решение 2, по прецеденту `BalanceTransaction.direction`).
const taskDirectionSchema = z.enum(['service', 'shop']);
export type TaskDirection = z.infer<typeof taskDirectionSchema>;

// ========================== Статус задачи ========================== //

// Шесть состояний жизненного цикла (design.md решение 3, specs/tasks/spec.md «Жизненный цикл
// статуса задачи»). Допустимые переходы (проверяются доменным VO `TaskStatus` на бэкенде, не здесь):
// NEW → IN_PROGRESS → DONE → {CLOSED_SUCCESSFULLY | CLOSED_UNSUCCESSFULLY | REWORK};
// REWORK → IN_PROGRESS. CLOSED_SUCCESSFULLY/CLOSED_UNSUCCESSFULLY — терминальные, переходов из них
// нет. Только CLOSED_SUCCESSFULLY делает связанное зарплатное правило доступным для начисления.
const taskStatusSchema = z.enum([
    'NEW',
    'IN_PROGRESS',
    'DONE',
    'CLOSED_SUCCESSFULLY',
    'CLOSED_UNSUCCESSFULLY',
    'REWORK',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

// ========================== Задача (ответ API) ========================== //

// closedSuccessfullyAt — момент перевода в CLOSED_SUCCESSFULLY (design.md решение 2), null пока
// задача не закрыта успешно (в т.ч. если она уже закрыта неуспешно/на доработке).
const taskSchema = z.object({
    id: z.string(),
    direction: taskDirectionSchema.nullable(),
    title: z.string(),
    description: z.string().nullable(),
    deadline: z.coerce.date(),
    assigneeEmployeeId: z.number(),
    status: taskStatusSchema,
    closedSuccessfullyAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type Task = z.infer<typeof taskSchema>;

// ========================== Создание задачи ========================== //

// POST /v1/tasks — единственный вход создания задачи (design.md решение 1/4): и напрямую с фронта
// (форма `features/CreateTask`, шаг 1 мастера создания правила `TaskCompletion`), и `accounting`
// (`EnsureRuleTaskForPeriodService`, автосоздание задачи регулярного правила на новый период — через
// `CommandBus`, тот же публичный use-case, не отдельный «бэкдор»). НЕ принимает и не знает про
// `salaryRuleId`/`period`/`isRecurring` — задача полностью самостоятельна (specs/tasks/spec.md
// «Задача — полностью самостоятельная сущность»).
const createTaskRequestSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    // ISO-строка, не z.coerce.date() — тело запроса идёт в генерацию OpenAPI (тот же приём, что
    // isoDateStringSchema у employee-balance.ts/salary-payout.ts: zod v4 toJSONSchema() не умеет
    // сериализовать Date).
    deadline: isoDateStringSchema,
    assigneeEmployeeId: z.number(),
    direction: taskDirectionSchema.optional(),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

const createTaskResponseSchema = z.object({ id: z.string() });
export type CreateTaskResponse = z.infer<typeof createTaskResponseSchema>;

// ========================== Список задач ========================== //

// GET /v1/tasks?status&direction — фильтр списка страницы `/tasks` (ui-design.md, фрейм `iZrrX`).
const listTasksQuerySchema = z.object({
    status: taskStatusSchema.optional(),
    direction: taskDirectionSchema.optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

// ========================== Переход статуса ========================== //

// PATCH /v1/tasks/:id/status — self-service переход ответственного сотрудника/руководителя
// (specs/tasks/spec.md «Ответственный сотрудник ведёт задачу до готовности», «Проверка и закрытие
// задачи руководителем», «Возврат с доработки в работу»). `taskId` приходит из URL-параметра;
// действующий сотрудник (`actorEmployeeId` доменного `Task.transitionTo`) резолвится backend'ом из
// сессии аутентифицированного пользователя, а не из тела запроса — RBAC/различение роли вызывающего
// вне скоупа этого change (см. tasks.md, «Решения, зафиксированные перед написанием этого списка»);
// `ChangeTaskStatusHandler` проверяет только сам граф переходов (`TaskStatus.canTransitionTo`), не
// то, кто именно его вызывает.
const changeTaskStatusRequestSchema = z.object({
    targetStatus: taskStatusSchema,
});

export type ChangeTaskStatusRequest = z.infer<
    typeof changeTaskStatusRequestSchema
>;

export {
    taskDirectionSchema,
    taskStatusSchema,
    taskSchema,
    createTaskRequestSchema,
    createTaskResponseSchema,
    listTasksQuerySchema,
    changeTaskStatusRequestSchema,
};
