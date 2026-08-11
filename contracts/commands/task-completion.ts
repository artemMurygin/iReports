import { z } from 'zod';

// Выполнение задачи сотрудником — источник данных для TaskCompleted.calculate()
// (Фаза 8, см. docs/payroll/plan-payroll-calculation.md). Двухступенчатый
// внутренний воркфлоу подтверждения БЕЗ интеграции с Bitrix24 Tasks в этой
// итерации: сотрудник отмечает свою задачу выполненной (PENDING_CONFIRMATION),
// руководитель подтверждает (CONFIRMED) — только подтверждённые записи
// участвуют в расчёте. Синхронизация с реальными задачами Bitrix24
// запланирована отдельной фазой, не реализуется здесь; description —
// произвольный текст, содержимое задачи сейчас не важно, важен факт и статус.
const taskCompletionStatusSchema = z.enum([
    'PENDING_CONFIRMATION',
    'CONFIRMED',
    'REJECTED',
]);

export type TaskCompletionStatus = z.infer<typeof taskCompletionStatusSchema>;

// Создаётся сотрудником (или от его имени) — сразу в статусе
// PENDING_CONFIRMATION, createdBy обычно совпадает с employeeId, но не
// обязан (запись может завести и руководитель за сотрудника).
const createTaskCompletionRequestSchema = z.object({
    employeeId: z.number().int().positive(),
    period: z.string(),
    description: z.string().min(1),
    createdBy: z.number().int().positive(),
});

export type CreateTaskCompletionRequest = z.infer<
    typeof createTaskCompletionRequestSchema
>;

// Подтверждение (или отклонение) руководителем — единственное разрешённое
// изменение статуса после создания записи.
const confirmTaskCompletionRequestSchema = z.object({
    confirmedBy: z.number().int().positive(),
});

export type ConfirmTaskCompletionRequest = z.infer<
    typeof confirmTaskCompletionRequestSchema
>;

const rejectTaskCompletionRequestSchema = confirmTaskCompletionRequestSchema;

export type RejectTaskCompletionRequest = z.infer<
    typeof rejectTaskCompletionRequestSchema
>;

const listTaskCompletionsQuerySchema = z.object({
    period: z.string(),
    employeeId: z.coerce.number().int().positive().optional(),
});

export type ListTaskCompletionsQuery = z.infer<
    typeof listTaskCompletionsQuerySchema
>;

const taskCompletionResponseSchema = z.object({
    id: z.string(),
    employeeId: z.number(),
    period: z.string(),
    description: z.string(),
    status: taskCompletionStatusSchema,
    createdBy: z.number(),
    createdAt: z.coerce.date(),
    confirmedBy: z.number().nullable(),
    confirmedAt: z.coerce.date().nullable(),
    updatedAt: z.coerce.date(),
});

export type TaskCompletionResponse = z.infer<
    typeof taskCompletionResponseSchema
>;

export {
    taskCompletionStatusSchema,
    createTaskCompletionRequestSchema,
    confirmTaskCompletionRequestSchema,
    rejectTaskCompletionRequestSchema,
    listTaskCompletionsQuerySchema,
    taskCompletionResponseSchema,
};
