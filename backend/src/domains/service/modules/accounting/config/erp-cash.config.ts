// Конфигурация кассы RemOnline направления service для выплат зарплаты
// (PRD 3, Фаза 11/12) — файловый конфиг модуля на основе переменных
// окружения вместо строки в БД (правка пользователя от 2026-08-24): значение
// читается один раз при старте процесса, читается ErpCashConfigProvider
// (infrastructure/config/erp-cash-config.provider.ts) через
// ErpCashConfigRepositoryPort — единственная точка, где задаётся ID кассы,
// эндпоинта записи (PUT) для него больше нет.
export const serviceErpCashConfig = {
    roappCashboxId: process.env.ROAPP_CASHBOX_ID
        ? Number(process.env.ROAPP_CASHBOX_ID)
        : null,
    // Cashflow Category ID — RemOnline отклоняет POST .../transactions без
    // category_id (400 при выплате, обнаружено 2026-08-25).
    roappCategoryId: process.env.ROAPP_CATEGORY_ID
        ? Number(process.env.ROAPP_CATEGORY_ID)
        : null,
};
