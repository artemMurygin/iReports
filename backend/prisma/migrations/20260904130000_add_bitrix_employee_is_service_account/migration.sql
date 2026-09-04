-- AlterTable
-- Локальный, независимый от Bitrix24-синхронизации признак «служебный
-- аккаунт» (docs/employee-ordering-and-salary-filter, Фаза 3) — та же
-- миграционная дисциплина, что и у order (Фаза 1, см.
-- 20260904112231_add_bitrix_employee_order/migration.sql): чисто аддитивная
-- колонка с DEFAULT false, без бэкфилла (все существующие сотрудники — не
-- служебные аккаунты по умолчанию, отметка проставляется вручную через
-- PATCH .../employees/:id/service-account).
ALTER TABLE "bitrix_employees" ADD COLUMN     "is_service_account" BOOLEAN NOT NULL DEFAULT false;
