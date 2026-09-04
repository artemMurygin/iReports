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
