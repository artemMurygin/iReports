// Точечное расширение существующего синка src/sync/bitrix (design.md,
// Decision 11/Migration Plan шаг 2) — самовосстановление отсутствующей
// строки BitrixEmployee на пути логина `auth`, т.к. BitrixSyncService.
// uploadEmployees() сегодня НЕ на кроне, а только ручной npm run initial.
// Владелец порта — src/sync/bitrix, потребитель — src/modules/auth.
export interface BitrixEmployeeUpsertPort {
    upsertOne(bitrixUserId: number): Promise<void>;
}

export const BITRIX_EMPLOYEE_UPSERT_PORT = Symbol(
    'BITRIX_EMPLOYEE_UPSERT_PORT',
);
