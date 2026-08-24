import { z } from 'zod';

// Ответ POST /finance/accounts/{account_id}/transactions (RoappCashDocumentAdapter,
// PRD 3 docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 11). OpenAPI-спецификация RemOnline (проверено через MCP RoApp,
// get-endpoint, 2026-08-24) не описывает тело ответа 200 вообще — только
// код статуса, поэтому схема сознательно минимальна (только то поле, без
// которого адаптер не может вернуть externalId вызывающей стороне) и не
// разбирает остальные поля движения. id — как и везде в RemOnline (см.
// OrderSchema/ServiceSchema) может прийти числом; парсим строго через zod,
// а не приводим `as`, чтобы неожиданная форма ответа падала явной
// BadGatewayException, а не тихо давала externalId: "undefined".
export const FinanceTransactionSchema = z.object({
    id: z.union([z.number(), z.string()]),
});
