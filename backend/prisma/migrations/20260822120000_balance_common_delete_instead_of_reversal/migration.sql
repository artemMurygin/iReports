-- Фаза 8b (PRD 2 docs/payroll-closing-and-accrual): баланс общий по
-- сотруднику, ошибочные ручные движения удаляются вместо сторно.
-- Существующие движения MANUAL_REVERSAL и сторнированные ими исходные
-- движения удаляются парой: по новой модели ошибочное движение просто
-- исчезает из ленты, а пара «движение + его противоположность» в сумме
-- даёт 0 — остатки сотрудников от удаления пары не меняются.
DELETE FROM "balance_transactions"
WHERE "type" = 'MANUAL_REVERSAL'
   OR "id" IN (
        SELECT "reversed_transaction_id" FROM "balance_transactions"
        WHERE "reversed_transaction_id" IS NOT NULL
   );

-- AlterEnum
BEGIN;
CREATE TYPE "balance_transaction_type_new" AS ENUM ('SALARY_ACCRUAL', 'ACCRUAL_ADJUSTMENT', 'ADVANCE', 'EXTRA_ADVANCE', 'BONUS', 'SICK_LEAVE', 'VACATION_PAY', 'PENALTY', 'ADJUSTMENT', 'PAYOUT');
ALTER TABLE "balance_transactions" ALTER COLUMN "type" TYPE "balance_transaction_type_new" USING ("type"::text::"balance_transaction_type_new");
ALTER TYPE "balance_transaction_type" RENAME TO "balance_transaction_type_old";
ALTER TYPE "balance_transaction_type_new" RENAME TO "balance_transaction_type";
DROP TYPE "public"."balance_transaction_type_old";
COMMIT;

-- DropIndex
DROP INDEX "balance_transactions_employee_id_direction_occurred_at_idx";

-- DropIndex
DROP INDEX "balance_transactions_reversed_transaction_id_key";

-- AlterTable
ALTER TABLE "balance_transactions" DROP COLUMN "reversed_transaction_id";

-- CreateIndex
CREATE INDEX "balance_transactions_employee_id_occurred_at_idx" ON "balance_transactions"("employee_id", "occurred_at");
