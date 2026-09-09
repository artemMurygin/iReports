import { z } from 'zod';

/**
 * Раздел 5 tasks.md (add-task-based-salary-rule): write-методы BitrixService
 * над `tasks.task.*` (design.md Decision 2, `tasks.task.add`/`tasks.task.update`,
 * не deprecated `task.item.*`).
 *
 * ⚠️ Точный формат `fields`/кодов `STATUS` предписано сверить через
 * `mcp__claude_ai_Bitrix_24__bitrix-method-details` перед реализацией — в этой
 * среде инструмент был недоступен (сетевая ошибка прокси, см. отчёт задачи).
 * Схемы ниже реализованы по документированному публичному формату Bitrix24
 * REST API (Tasks API, поколение с camelCase-полями в ответах и UPPERCASE-
 * полями в `fields` запроса) — требуют сверки на реальном портале до продакшена.
 */

/** Код статуса "Завершена" в Bitrix24 Tasks API (STATUS = 5). */
export const BITRIX_TASK_STATUS_COMPLETED = 5;

/**
 * Код статуса новой задачи по умолчанию в Bitrix24 Tasks API (STATUS = 2,
 * "Новая") — подтверждено примером ответа `tasks.task.add` через
 * `mcp__claude_ai_Bitrix_24__bitrix-method-details` (доступен в сессии
 * раздела 11 tasks.md add-task-based-salary-rule, в отличие от раздела 5,
 * где инструмент был недоступен, см. примечание выше). Используется
 * `EnsureSalaryTaskForPeriodService` (раздел 11) как первичный
 * `SalaryTask.taskStatus` сразу после создания задачи — до первого прохода
 * `SalaryTaskStatusSyncCron` (раздел 8), который освежит его реальным
 * значением из Bitrix24.
 */
export const BITRIX_TASK_STATUS_NEW = 2;

export const BitrixCreateTaskRequestSchema = z.object({
    responsibleBitrixUserId: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string().optional(),
    deadline: z.instanceof(Date),
});
export type BitrixCreateTaskRequest = z.infer<
    typeof BitrixCreateTaskRequestSchema
>;

/** Ответ tasks.task.add: `{ result: { task: { id } } }`. */
export const BitrixTaskAddResponseSchema = z.object({
    result: z.object({
        task: z.object({
            id: z.union([z.string(), z.number()]),
        }),
    }),
});

/** Ответ tasks.task.update: `{ result: true }`. */
export const BitrixTaskUpdateResponseSchema = z.object({
    result: z.union([z.literal(true), z.record(z.string(), z.unknown())]),
});

/**
 * Ответ batch-запроса статусов задач (обёртка над N вызовов
 * `tasks.task.get?taskId=...&select[]=STATUS`, см. `fetchTaskStatusesBatch`).
 * `result.result` — успешные ответы по ключу cmd (== bitrixTaskId);
 * `result.result_error` — задачи, не вернувшиеся успешно (не роняют весь батч).
 *
 * Значения `result.result`/`result_error` намеренно НЕ типизированы строго
 * (`z.unknown()`) — на практике Bitrix24 кладёт под ключ несуществующей/
 * недоступной задачи пустой массив `[]` вместо объекта `{task:{status}}`, а
 * `result_error` может прийти массивом, а не record-ом (сталкивались в
 * проде: одна удалённая задача в батче валила весь `.parse()` при строгой
 * схеме, из-за чего статус переставал синкаться вообще для всех задач
 * батча). Разбор конкретной формы каждого элемента `result.result` —
 * ответственность `fetchTaskStatusesBatch` (per-key `safeParse`), не этой
 * схемы: она только гарантирует, что верхнеуровневая обёртка `{result:
 * {result}}` вообще пришла.
 */
export const BitrixBatchTaskStatusResponseSchema = z.object({
    result: z.object({
        result: z.record(z.string(), z.unknown()),
        result_error: z.unknown().optional(),
    }),
});

/** Форма одного УСПЕШНОГО элемента `result.result` — см. `BitrixBatchTaskStatusResponseSchema`. */
export const BitrixTaskStatusEntrySchema = z.object({
    task: z.object({
        status: z.union([z.string(), z.number()]),
    }),
});

export const BitrixDealSchema = z
    .object({
        ID: z.string(),
        TITLE: z.string().nullable(),
        CATEGORY_ID: z.string(),
        STAGE_ID: z.string().nullable(),
        CURRENCY_ID: z.string().nullable(),
        OPPORTUNITY: z.string().nullable(),
        ASSIGNED_BY_ID: z.string().nullable(),
        COMPANY_ID: z.string().nullable().optional(),
        CONTACT_ID: z.string().nullable().optional(),
        DATE_CREATE: z.string(),
        DATE_MODIFY: z.string().nullable(),
        SOURCE_ID: z.string().nullable().optional(),
        UF_CRM_1742462651851: z.string().nullable().optional(),
        UF_CRM_1730472738: z.string().nullable().optional(),
        UF_CRM_1703248170106: z.string().nullable().optional(),
        UF_CRM_1703248232698: z.string().nullable().optional(),
        UF_CRM_1703248682036: z.string().nullable().optional(),
    })
    .transform((d) => ({
        id: Number(d.ID),
        title: d.TITLE,
        categoryId: Number(d.CATEGORY_ID),
        stageId: d.STAGE_ID,
        opportunity: d.OPPORTUNITY ? parseFloat(d.OPPORTUNITY) : 0,
        assignedById: Number(d.ASSIGNED_BY_ID),
        contactId: d.CONTACT_ID ? Number(d.CONTACT_ID) : null,
        pointOfContactId: d.SOURCE_ID ? d.SOURCE_ID : null,
        leadSourceId: d.UF_CRM_1742462651851
            ? Number(d.UF_CRM_1742462651851)
            : 0,
        brandId: d.UF_CRM_1730472738 ? Number(d.UF_CRM_1730472738) : null,
        deviceTypeId: d.UF_CRM_1703248170106
            ? Number(d.UF_CRM_1703248170106)
            : 0,
        deviceModel: d.UF_CRM_1703248232698 ?? null,
        deviceMalfunction: d.UF_CRM_1703248682036 ?? null,
        createdAt: new Date(d.DATE_CREATE),
        updatedAt: d.DATE_MODIFY ? new Date(d.DATE_MODIFY) : null,
    }));
