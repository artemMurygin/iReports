-- AlterTable
-- Старый сентинел "без категории" был NO_CATEGORY_ID = -1 (Int); новый —
-- NO_CATEGORY_ID = '' (String, см. sales-plan.mapper.ts) — переносим -1 в
-- '', а не в '-1', чтобы сентинел остался распознаваемым доменом.
ALTER TABLE "sales_plan_templates" ALTER COLUMN "category_id" TYPE TEXT
  USING (CASE WHEN "category_id" = -1 THEN '' ELSE "category_id"::text END);

-- AlterTable
ALTER TABLE "sales_plans" ALTER COLUMN "category_id" TYPE TEXT
  USING (CASE WHEN "category_id" = -1 THEN '' ELSE "category_id"::text END);
