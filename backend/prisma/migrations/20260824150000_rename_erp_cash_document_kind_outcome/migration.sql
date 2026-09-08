-- Фаза 12 PRD 3 (docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md):
-- приводим ErpCashDocumentKind к терминологии самого PRD ("OUTCOME", не
-- "EXPENSE" — см. WHY-комментарий у erpCashDocumentKindSchema в
-- contracts/commands/erp-cash.ts до этой миграции). RENAME VALUE, а не
-- drop+recreate — единственная строка erp_cash_documents.kind = 'EXPENSE'
-- (если такая уже есть в БД) должна остаться читаемой без ручного backfill.
ALTER TYPE "erp_cash_document_kind" RENAME VALUE 'EXPENSE' TO 'OUTCOME';
