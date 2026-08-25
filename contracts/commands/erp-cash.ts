import { z } from 'zod';
import { salesDirectionSchema } from './sales-plan';
import { externalSystemSchema } from './employee-identity';

// Кассовые документы ERP (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 11) — связка «движение баланса → документ ERP» и конфигурация кассы/
// статей по направлению. Сама выплата (SalaryPayout) и её эндпоинты —
// Фаза 12, здесь только то, что нужно адаптерам записи в ERP: форма
// документа-связки и форма настройки, которую администратор заполняет один
// раз в GET/PUT /v1/{direction}/accounting/erp_cash_config.
//
// Блокер Фазы 11 (поддерживает ли ERP удаление кассового документа) снят
// предварительным исследованием через MCP RoApp/МойСклад (2026-08-24):
// RemOnline — POST/DELETE /finance/accounts/{account_id}/transactions/{id};
// МойСклад — POST/DELETE /entity/{cashout,cashin}/{id}. Оба подтверждают
// главный критерий готовности PRD 3 — «руководитель ошибся» реализуемо в
// обеих ERP.

// ========================== ErpCashDocument ========================== //

// Тип документа назван по терминологии PRD 3 (Фаза 12: переименовано из
// EXPENSE в OUTCOME — «Сущность-связка: ... тип (OUTCOME / INCOME)», для
// консистентности с остальным текстом PRD 3, который везде говорит
// «OUTCOME»). Изначально (Фаза 11) было выбрано INCOME/EXPENSE по вокабуляру
// самого RemOnline (POST /finance/accounts/{id}/transactions принимает
// direction: "income" | "expense") — адаптеры по-прежнему сами мапят
// OUTCOME → "expense"/cashout на границе с конкретной ERP (см.
// RoappCashDocumentAdapter/MoyskladCashDocumentAdapter), лишнего шага
// маппинга enum → enum это не создаёт, только имя внутреннего значения.
const erpCashDocumentKindSchema = z.enum(['INCOME', 'OUTCOME']);
export type ErpCashDocumentKind = z.infer<typeof erpCashDocumentKindSchema>;

// Документ существует только вместе с движением баланса, которое его
// породило (PRD 3: «либо есть оба, либо нет ни одного») — transactionId
// ссылается на BalanceTransaction.id (contracts/commands/employee-balance.ts)
// и уникален в БД (см. Prisma-модель ErpCashDocument): один и тот же
// transactionId не может породить два документа, это и есть защита от
// задвоения на уровне БД, на которую опирается ErpCashDocumentPort.findByKey
// (см. application/ports/erp-cash-document.port.ts в domains/{service,shop}).
// amount — Int, целые рубли без знака (кассовое направление уже несёт знак
// через kind); externalId — id документа в ERP (RemOnline transaction id /
// МойСклад cashout|cashin id), показывается в ленте баланса (PRD 3).
const erpCashDocumentSchema = z.object({
    id: z.string(),
    transactionId: z.string(),
    system: externalSystemSchema,
    kind: erpCashDocumentKindSchema,
    amount: z.number().int().nonnegative(),
    externalId: z.string(),
    createdAt: z.coerce.date(),
});
export type ErpCashDocument = z.infer<typeof erpCashDocumentSchema>;

// ========================== ErpCashConfig ========================== //

// Конфигурация кассы направления — один общий z.object с полями обоих
// направлений вместо z.discriminatedUnion<direction>: GET уже даёт
// разделение по направлению через сам путь (/v1/service/accounting/
// erp_cash_config и /v1/shop/.../erp_cash_config, см. app.routes.ts) —
// дискриминированный union добавил бы вариантность без объекта, к которому
// она была бы привязана. direction — только для отображения/диагностики в
// ответе, не для ветвления клиентом.
//
// ПРАВКА ПОЛЬЗОВАТЕЛЯ (2026-08-24, см. заметку в конце Фазы 11 плана
// docs/payroll-closing-and-accrual/plan-payroll-closing-and-accrual.md):
// конфигурация больше не строка БД, редактируемая через PUT, а файловый
// конфиг модуля на основе env-переменных
// (backend/src/domains/{service,shop}/modules/accounting/config/
// erp-cash.config.ts) — put*ErpCashConfigRequestSchema и PUT-эндпоинты
// убраны, GET остался как read-only диагностика, updatedAt теперь всегда
// null (нет БД-записи с меткой времени, поле оставлено ради формы ответа).
//
// moySkladIncomeItemId — РЕШЕНИЕ: поле оставлено, но задел на будущее, не
// отправляется в API МойСклад: исследование через MCP moysklad
// (get_schema_fields('CashIn'), 2026-08-24) подтвердило, что схема CashIn не
// содержит поля вроде expenseItem вообще — у приходного ордера МойСклада
// нет понятия «статья доходов» в принципе, в отличие от статьи расходов
// CashOut. Адаптер МойСклада не передаёт это поле в теле POST /entity/cashin
// — оно хранится только на случай, если МойСклад добавит такое поле или
// появится другой способ разметки прихода (например, через attributes),
// либо будет осознанно удалено, когда станет ясно, что оно не понадобится.
const erpCashConfigSchema = z.object({
    direction: salesDirectionSchema,
    // service: id единственной кассы (Finance Account) RemOnline.
    roappCashboxId: z.number().int().positive().nullable(),
    // service: Cashflow Category ID — RemOnline отклоняет POST
    // .../transactions без category_id (400, обнаружено 2026-08-25), хотя
    // формально схема эндпоинта не помечает поле обязательным.
    roappCategoryId: z.number().int().positive().nullable(),
    // shop: статья расходов для cashout — обязательное поле МойСклада
    // (expenseItem), без него операция отклоняется до обращения в ERP.
    moySkladExpenseItemId: z.string().nullable(),
    // shop: см. комментарий выше — хранится, но не используется адаптером.
    moySkladIncomeItemId: z.string().nullable(),
    // shop: юрлицо (organization) — тоже обязательное поле и у cashout, и у
    // cashin.
    organizationId: z.string().nullable(),
    // Всегда null — см. ПРАВКА ПОЛЬЗОВАТЕЛЯ выше.
    updatedAt: z.coerce.date().nullable(),
});
export type ErpCashConfigResponse = z.infer<typeof erpCashConfigSchema>;

export { erpCashDocumentKindSchema, erpCashDocumentSchema, erpCashConfigSchema };
