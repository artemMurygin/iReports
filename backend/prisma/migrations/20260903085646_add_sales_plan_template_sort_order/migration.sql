-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "sales_plan_templates" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);

-- Backfill: заполняем sortOrder для уже существующих строк шаблона так,
-- чтобы порядок совпадал с прежней сортировкой по умолчанию
-- (departmentId asc, categoryId asc, см. findByDirectionAndPeriod до этой
-- миграции) — иначе после включения sortOrder-сортировки все существующие
-- строки схлопнулись бы в один и тот же порядок (общий DEFAULT 0) и
-- отображались бы в непредсказуемом порядке между собой. Нумерация — от 0,
-- отдельно на каждую пару (direction, department_id), чтобы совпадать с
-- дефолтным значением новых строк (DEFAULT 0 выше).
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY direction, department_id
            ORDER BY category_id
        ) - 1 AS rn
    FROM "sales_plan_templates"
)
UPDATE "sales_plan_templates" AS t
SET "sort_order" = ranked.rn
FROM ranked
WHERE t.id = ranked.id;
