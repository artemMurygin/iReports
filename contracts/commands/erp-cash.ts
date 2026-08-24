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
// направлений вместо z.discriminatedUnion<direction>: персистентность —
// одна Prisma-модель ErpCashConfig на строку-направление (не две разных
// формы), а GET/PUT уже даёт разделение по направлению через сам путь
// (/v1/service/accounting/erp_cash_config и /v1/shop/.../erp_cash_config,
// см. app.routes.ts) — дискриминированный union добавил бы вариантность
// без объекта, к которому она была бы привязана: клиент каждого направления
// и так знает, какие поля ему нужны (см. put*ErpCashConfigRequestSchema
// ниже — раздельные схемы запроса на PUT уже дают проверку «не подсунуть
// чужие поля своему направлению»). direction — только для отображения/
// диагностики в ответе, не для ветвления клиентом.
//
// moySkladIncomeItemId — РЕШЕНИЕ: поле оставлено (Prisma-модель ErpCashConfig
// и это API его хранят), но задел на будущее, не отправляется в API МойСклад:
// исследование через MCP moysklad (get_schema_fields('CashIn'), 2026-08-24)
// подтвердило, что схема CashIn не содержит поля вроде expenseItem вообще —
// у приходного ордера МойСклада нет понятия «статья доходов» в принципе, в
// отличие от статьи расходов CashOut. Адаптер МойСклада (Фаза 11, следующий
// агент) не должен передавать это поле в теле POST /entity/cashin — оно
// хранится только на случай, если МойСклад добавит такое поле или появится
// другой способ разметки прихода (например, через attributes), либо будет
// осознанно удалено, когда станет ясно, что оно не понадобится.
const erpCashConfigSchema = z.object({
    direction: salesDirectionSchema,
    // service: id единственной кассы (Finance Account) RemOnline.
    roappCashboxId: z.number().int().positive().nullable(),
    // shop: статья расходов для cashout — обязательное поле МойСклада
    // (expenseItem), без него операция отклоняется до обращения в ERP.
    moySkladExpenseItemId: z.string().nullable(),
    // shop: см. комментарий выше — хранится, но не используется адаптером.
    moySkladIncomeItemId: z.string().nullable(),
    // shop: юрлицо (organization) — тоже обязательное поле и у cashout, и у
    // cashin.
    organizationId: z.string().nullable(),
    // null — направление ещё ни разу не конфигурировали (GET до первого PUT).
    updatedAt: z.coerce.date().nullable(),
});
export type ErpCashConfigResponse = z.infer<typeof erpCashConfigSchema>;

// PUT — upsert по направлению (естественный ключ, direction определяется
// путём запроса, а не телом — тот же приём, что и у
// putSalesPlanTemplateRequestSchema): раздельные схемы на service/shop,
// чтобы поля другого направления нельзя было передать по ошибке — сервер бы
// их всё равно проигнорировал (конфигурация читается по своим полям), но
// схема отклоняет их уже на границе HTTP.
const putServiceErpCashConfigRequestSchema = z.object({
    roappCashboxId: z.number().int().positive(),
});
export type PutServiceErpCashConfigRequest = z.infer<
    typeof putServiceErpCashConfigRequestSchema
>;

const putShopErpCashConfigRequestSchema = z.object({
    moySkladExpenseItemId: z.string().min(1),
    organizationId: z.string().min(1),
    // Опционален и пока ни на что не влияет — см. WHY-комментарий у
    // moySkladIncomeItemId в erpCashConfigSchema.
    moySkladIncomeItemId: z.string().min(1).optional(),
});
export type PutShopErpCashConfigRequest = z.infer<
    typeof putShopErpCashConfigRequestSchema
>;

export {
    erpCashDocumentKindSchema,
    erpCashDocumentSchema,
    erpCashConfigSchema,
    putServiceErpCashConfigRequestSchema,
    putShopErpCashConfigRequestSchema,
};
