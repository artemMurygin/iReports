-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "bitrix_employees" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill: заполняем order для уже существующих сотрудников так, чтобы
-- порядок совпадал с прежней сортировкой по умолчанию (lastName asc,
-- firstName asc, см. DirectoryRepository.findEmployees до этой миграции) —
-- иначе после включения сортировки по order все существующие сотрудники
-- схлопнулись бы в один и тот же порядок (общий DEFAULT 0) и отображались
-- бы в непредсказуемом порядке между собой (docs/employee-ordering-and-salary-filter,
-- Фаза 1).
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY "lastName", "firstName") - 1 AS rn
    FROM "bitrix_employees"
)
UPDATE "bitrix_employees" AS e
SET "order" = ranked.rn
FROM ranked
WHERE e.id = ranked.id;

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);
