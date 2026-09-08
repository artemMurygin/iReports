-- Фаза 4 docs/service-shop-boundary-violations-fix: erp_cash_documents
-- остаётся одной общей таблицей (пользовательское решение, см.
-- backend/CLAUDE.md, "Общие таблицы между service и shop"), но получает
-- различающее поле direction, чтобы у service/shop могли появиться
-- собственные независимые Entity/Port/Repository-классы поверх неё
-- (ErpCashDocument в domains/service, ShopErpCashDocument в domains/shop).
--
-- AlterTable: аддитивно добавляем nullable-колонку (без DEFAULT и без
-- NOT NULL) — часть писателей таблицы (например,
-- CreateBalanceTransactionHandler в src/modules/employee-balance/, общий
-- для обоих направлений и вне скоупа этой фазы) её пока не заполняет, см.
-- комментарий в prisma/schema/erp-cash.prisma.
ALTER TABLE "erp_cash_documents" ADD COLUMN "direction" "sales_direction";

-- Backfill существующих строк из уже существующего system — единственно
-- возможное сопоставление (RemOnline обслуживает только service, МойСклад
-- — только shop).
UPDATE "erp_cash_documents"
SET "direction" = CASE "system"
    WHEN 'ROAPP' THEN 'service'::"sales_direction"
    WHEN 'MOY_SKLAD' THEN 'shop'::"sales_direction"
END;
