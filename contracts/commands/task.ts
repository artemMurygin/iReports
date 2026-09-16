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

// ========================== Обновление задачи ========================== //

// PATCH /v1/tasks/:id — частичное обновление полей существующей задачи (openspec/changes/edit-task).
// Все поля опциональны — партиал на всех уровнях (contracts → command → entity), см. design.md
// Decision 2 этого change: недоступно для задачи в терминальном статусе (см. Task.update,
// TaskAlreadyClosedException) — это НЕ проверяется здесь, только на бэкенде.
const updateTaskRequestSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    deadline: isoDateStringSchema.optional(),
    assigneeEmployeeId: z.number().optional(),
});

export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;

// ========================== Комментарий к задаче ========================== //

// Комментарий — собственная сущность модуля `tasks` (add-task-salary-rule-links-comments,
// design.md решение 1: «TaskComment и TaskLink — новые таблицы в modules/tasks, без Prisma
// @relation»), хранится рядом с `Task`, `taskId` — обычное поле, не foreign-key-`@relation`, по тому
// же прецеденту, что и `assigneeEmployeeId` выше (источник сотрудника — внешний, Bitrix).
// authorEmployeeId на создании резолвится backend'ом из сессии (`req.user.employeeId`,
// `SessionAuthGuard`), а не приходит в теле запроса — здесь описан персистентный/ответный вид
// комментария (`tasks/comments#Requirement: Комментарий фиксирует автора, время и текст`). text —
// непустая строка (`tasks/comments#Requirement: Пустой комментарий отклоняется`; строка только из
// пробелов отклоняется доменным VO `TaskCommentBody` на бэкенде, `min(1)` здесь — базовая проверка
// «не пустая совсем»).
const taskCommentSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    authorEmployeeId: z.number(),
    text: z.string().min(1),
    createdAt: z.coerce.date(),
});

export type TaskComment = z.infer<typeof taskCommentSchema>;

// POST /v1/tasks/:id/comments — тело запроса на создание комментария. Без `authorEmployeeId` (из
// сессии, см. выше) и без `id`/`taskId`/`createdAt` (id из URL, остальное генерирует бэкенд).
const createTaskCommentRequestSchema = z.object({
    text: z.string().min(1),
});

export type CreateTaskCommentRequest = z.infer<
    typeof createTaskCommentRequestSchema
>;

// ========================== Ссылка на задаче ========================== //

// Ссылка — собственная сущность модуля `tasks` (design.md решение 1), тем же приёмом, что и
// `taskCommentSchema` выше — `taskId` обычным полем, без `@relation`. url — синтаксически валидный
// адрес (доменный VO `TaskLinkUrl` на бэкенде, `tasks/links#Requirement: Ссылка должна быть валидным
// адресом`), label — опциональная человекочитаемая подпись (design.md, Non-Goals: без превью/
// форматирования, только адрес и подпись).
const taskLinkSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    url: z.string().url(),
    label: z.string().optional(),
    createdAt: z.coerce.date(),
});

export type TaskLink = z.infer<typeof taskLinkSchema>;

// POST /v1/tasks/:id/links — тело запроса на добавление ссылки.
const createTaskLinkRequestSchema = z.object({
    url: z.string().url(),
    label: z.string().optional(),
});

export type CreateTaskLinkRequest = z.infer<typeof createTaskLinkRequestSchema>;

export {
    taskDirectionSchema,
    taskStatusSchema,
    taskSchema,
    createTaskRequestSchema,
    createTaskResponseSchema,
    listTasksQuerySchema,
    changeTaskStatusRequestSchema,
    updateTaskRequestSchema,
    taskCommentSchema,
    createTaskCommentRequestSchema,
    taskLinkSchema,
    createTaskLinkRequestSchema,
};
