// Конфигурация кассы МойСклад направления shop для выплат зарплаты (PRD 3,
// Фаза 11/12) — файловый конфиг модуля на основе переменных окружения вместо
// строки в БД (правка пользователя от 2026-08-24): значения читаются один
// раз при старте процесса, читаются ErpCashConfigProvider
// (domains/service/modules/accounting/infrastructure/config/erp-cash-config.provider.ts,
// физически определён в domains/service вместе с остальным ErpCashConfig —
// см. WHY в application/ports/erp-cash-config.port.ts) через
// ErpCashConfigRepositoryPort — единственная точка, где задаются статья
// расходов и юрлицо, эндпоинта записи (PUT) для них больше нет.
export const shopErpCashConfig = {
    moySkladExpenseItemId: process.env.MOYSKLAD_EXPENSE_ITEM_ID ?? null,
    // Задел на будущее, не используется адаптером — см. WHY у
    // moySkladIncomeItemId в contracts/commands/erp-cash.ts.
    moySkladIncomeItemId: process.env.MOYSKLAD_INCOME_ITEM_ID ?? null,
    organizationId: process.env.MOYSKLAD_ORGANIZATION_ID ?? null,
};
