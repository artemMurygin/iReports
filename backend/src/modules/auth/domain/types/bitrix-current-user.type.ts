// Подмножество полей ответа Bitrix24 REST `user.current` — только то, что
// реально читается кодом (см. аналогичный подход в bitrix-api.types.ts).
export interface BitrixCurrentUserProfile {
    ID: string;
    NAME?: string | null;
    LAST_NAME?: string | null;
}
