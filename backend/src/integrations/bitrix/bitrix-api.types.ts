/**
 * Временная типизация ответов Bitrix24 REST API на границе интеграции
 * (BitrixService). Описывает только те поля, которые реально читаются
 * кодом — не полную структуру, которую отдаёт Bitrix.
 *
 * TODO: заменить на Zod-схемы (по аналогии с BitrixDealSchema в ./schema.ts)
 * и вывод типов через z.infer, когда дойдут руки до строгой валидации
 * остальных методов BitrixService.
 */

export interface BitrixListResponse<T> {
    result: T;
    next?: number;
}

export interface BitrixUser {
    ID: string;
    NAME: string | null;
    LAST_NAME: string | null;
    UF_DEPARTMENT: Array<string | number>;
    /** Активность пользователя — false у уволенного (user.get отдаёт и неактивных). */
    ACTIVE?: boolean;
}

export interface BitrixEnumListItem {
    ID: string | number;
    VALUE: string;
    SORT?: string | number;
}

export interface BitrixUserField {
    FIELD_NAME: string;
    LIST?: BitrixEnumListItem[];
}

/** Ответ /crm.deal.userfield.list, отфильтрованный по конкретному FIELD_NAME — LIST всегда есть. */
export interface BitrixFilteredUserField {
    FIELD_NAME: string;
    LIST: BitrixEnumListItem[];
}

export interface BitrixStatus {
    STATUS_ID: string;
    NAME: string;
    SORT: string | number;
    COLOR?: string;
    SYSTEM_TYPE?: string;
    ENTITY_ID: string;
}

/**
 * Нативные статусы задачи Bitrix24 Tasks (tasks.task.get → status).
 * Бизнес-значимы только три (design.md change salary-rule-bitrix-task,
 * Decision 6): PENDING = "Ждёт выполнения" (Создана), IN_PROGRESS =
 * "Выполняется" (Реализована), COMPLETED = "Завершена" (Закрыта).
 * Остальные коды (1 Новая, 4 Ожидает контроля, 6 Отложена, 7 Отклонена)
 * существуют в Bitrix24, но не участвуют в маппинге на бизнес-статусы
 * правила TaskCompleted.
 */
export type BitrixTaskStatus = '1' | '2' | '3' | '4' | '5' | '6' | '7';

export const BITRIX_TASK_STATUS = {
    PENDING: '2',
    IN_PROGRESS: '3',
    COMPLETED: '5',
} as const satisfies Record<string, BitrixTaskStatus>;

/** Один тег задачи в ответе tasks.task.get. */
export interface BitrixTaskTag {
    id: number;
    title: string;
}

/**
 * Форма поля `tags` в ответе tasks.task.get — объект, ключ которого это ID
 * тега (не список): `{ "16": { id: 16, title: "период:2026-08" }, ... }`.
 * Проверено вручную через реальный webhook — НЕ string[], как можно было бы
 * предположить по TAGS у tasks.task.add (там, наоборот, при создании
 * принимается плоский список строк — асимметрия чтения/записи у этого
 * метода Bitrix24). Пустой объект без тегов Bitrix (как типичный для PHP
 * API) может сериализоваться и как `[]` — поэтому допускаем оба варианта.
 */
export type BitrixTaskTagsField =
    Record<string, BitrixTaskTag> | BitrixTaskTag[];

/** Поля задачи Bitrix24 Tasks, читаемые BitrixTasksService (tasks.task.get, camelCase — ответ REST v3). */
export interface BitrixTask {
    id: string;
    title: string;
    status: BitrixTaskStatus;
    responsibleId: string;
    deadline: string | null;
    tags?: BitrixTaskTagsField;
}

/** Ответ метода `batch` — result.result хранит "сырой" result каждой под-команды по её ключу из cmd. */
export interface BitrixBatchResponse<T = unknown> {
    result: {
        result: Record<string, T>;
        result_error: Record<
            string,
            { error: string; error_description?: string }
        >;
    };
}

/**
 * Форма result отдельного вызова tasks.task.get внутри batch-ответа —
 * ключ `task`, а НЕ `item` (проверено вручную через реальный webhook;
 * `item` — на первый взгляд правдоподобное, но ошибочное предположение).
 */
export interface BitrixTaskGetBatchResult {
    task: BitrixTask;
}
