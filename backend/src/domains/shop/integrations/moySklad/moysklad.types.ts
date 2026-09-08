export type MoyskladListParams = {
    limit: number;
    offset: number;
    filter?: string;
    updatedFrom?: string;
    updatedTo?: string;
};

export type MoyskladMeta = {
    size: number;
    limit: number;
    offset: number;
};

/**
 * Временная типизация конверта ответов МойСклад REST API на границе
 * интеграции (MoyskladService) — строки списка намеренно `unknown`, их
 * проверяет и приводит к домену Zod (`*.schema.ts`) сразу внутри `.map()`.
 *
 * TODO: заменить на Zod-схему конверта, когда дойдут руки до строгой
 * валидации транспортного уровня (сейчас валидируются только элементы).
 */
export interface MoyskladListResponse {
    rows: unknown[];
    meta: MoyskladMeta;
}
