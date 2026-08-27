/**
 * Константы формата тегов Bitrix24 Tasks (design.md change salary-rule-bitrix-task,
 * Decision 7). Кастомные поля (UF_*) недоступны для создания на портале
 * пользователя, поэтому расчётный месяц и признак "зарплатная задача"
 * кодируются тегами задачи (TAGS) вместо кастомного поля:
 *
 * - расчётный месяц — тег `<BITRIX_TASK_PERIOD_TAG_PREFIX>:<YYYY-MM>`,
 *   например `период:2026-08`;
 * - тип задачи — фиксированный тег `BITRIX_SALARY_TASK_TAG` на каждой
 *   задаче-правиле.
 */
import type { BitrixTaskTagsField } from './bitrix-api.types';

export const BITRIX_TASK_PERIOD_TAG_PREFIX = 'период';
export const BITRIX_SALARY_TASK_TAG = 'Зарплатная задача';

const PERIOD_TAG_VALUE_FORMAT = /^\d{4}-\d{2}$/;

export function buildBitrixTaskPeriodTag(period: string): string {
    return `${BITRIX_TASK_PERIOD_TAG_PREFIX}:${period}`;
}

/**
 * Парсит расчётный месяц из тегов задачи. Возвращает null, если тег с
 * префиксом периода отсутствует или его значение не в формате YYYY-MM —
 * по spec.md ("Обработка недоступной задачи") это трактуется как
 * недоступность задачи, а не как ошибка расчёта.
 *
 * tasks.task.get отдаёт `tags` объектом, ключ которого — ID тега, а не
 * списком строк (`{ "16": { id: 16, title: "период:2026-08" }, ... }`);
 * пустой набор тегов при этом может прийти и как `[]` (типичная для PHP API
 * неоднозначность пустого массива/объекта) — Object.values() корректно
 * работает в обоих случаях.
 */
export function parseBitrixTaskPeriodTag(
    tags: BitrixTaskTagsField | undefined | null,
): string | null {
    const prefix = `${BITRIX_TASK_PERIOD_TAG_PREFIX}:`;
    const tag = Object.values(tags ?? {}).find((t) =>
        t.title.startsWith(prefix),
    );
    if (!tag) return null;

    const period = tag.title.slice(prefix.length);
    return PERIOD_TAG_VALUE_FORMAT.test(period) ? period : null;
}

/**
 * Прямая ссылка на карточку задачи в веб-интерфейсе Bitrix24 (зеркало
 * roapp-order-link.ts у RoApp) — используется в зарплатном отчёте и на
 * странице схемы мотивации (spec.md, "Ссылка на задачу Bitrix24"), чтобы
 * руководитель/сотрудник мог перейти к задаче. Путь без конкретного
 * пользователя (`/user/0/`) — Bitrix24 сам резолвит его для текущего
 * авторизованного пользователя портала независимо от исполнителя/
 * постановщика задачи.
 *
 * Возвращает undefined, если BITRIX24_WEBHOOK_URL не настроен/невалиден
 * (например, в тестовом окружении) — ссылка необязательный элемент UI,
 * её отсутствие не должно ронять расчёт зарплатного отчёта.
 */
export function buildBitrixTaskLink(taskId: number): string | undefined {
    const webhookUrl = process.env.BITRIX24_WEBHOOK_URL;
    if (!webhookUrl) return undefined;

    try {
        const portalOrigin = new URL(webhookUrl).origin;
        return `${portalOrigin}/company/personal/user/0/tasks/task/view/${taskId}/`;
    } catch {
        return undefined;
    }
}
