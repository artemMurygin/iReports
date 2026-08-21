export type Params = {
    modified_at?: string;
    created_at?: string;
    // Диапазон [from, to] по дате закрытия заказа (RoApp: массив из двух
    // ISO-дат — границы включительно) — синк месяца для закрытия периода.
    closed_at?: [string, string];
    page: number;
};

export interface RoappPaging {
    page: number;
    total_pages: number;
}

/**
 * Временная типизация конверта ответов RoApp REST API на границе интеграции
 * (RoappService) — элементы списка намеренно `unknown`, их проверяет и
 * приводит к домену Zod (`*.schema.ts`) сразу внутри `.map()`.
 *
 * TODO: заменить на Zod-схему конверта, когда дойдут руки до строгой
 * валидации транспортного уровня (сейчас валидируются только элементы).
 */
export interface RoappPaginatedResponse {
    data: unknown[];
    paging: RoappPaging;
}

/** Ответы без пагинации, но всё ещё обёрнутые в конверт `{ data: [...] }` (сотрудники, маркетинговые источники). */
export interface RoappDataEnvelope {
    data: unknown[];
}
