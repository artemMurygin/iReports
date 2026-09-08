-- Baseline migration: records schema changes that were already applied directly
-- to the database (bitrix_departments table + bitrix_employees cross-system links).
-- The original migration file that created them was deleted along with the
-- (now removed) salary report module; this restores migration history without
-- touching the already-existing tables/columns/constraints in the database.

-- CreateTable: bitrix_departments
CREATE TABLE "bitrix_departments" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "bitrix_departments_pkey" PRIMARY KEY ("id")
);

-- AlterTable: bitrix_employees — add cross-system links and FK to departments
ALTER TABLE "bitrix_employees"
    ADD COLUMN "moy_sklad_id" TEXT,
    ADD COLUMN "roapp_id" INTEGER;

-- CreateIndex: unique cross-system IDs
CREATE UNIQUE INDEX "bitrix_employees_roapp_id_key" ON "bitrix_employees"("roapp_id");
CREATE UNIQUE INDEX "bitrix_employees_moy_sklad_id_key" ON "bitrix_employees"("moy_sklad_id");

-- AddForeignKey: bitrix_employees.department -> bitrix_departments
ALTER TABLE "bitrix_employees" ADD CONSTRAINT "bitrix_employees_department_fkey"
    FOREIGN KEY ("department") REFERENCES "bitrix_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bitrix_employees.roapp_id -> roapp_employees
ALTER TABLE "bitrix_employees" ADD CONSTRAINT "bitrix_employees_roapp_id_fkey"
    FOREIGN KEY ("roapp_id") REFERENCES "roapp_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: bitrix_employees.moy_sklad_id -> moy_sklad_employees
ALTER TABLE "bitrix_employees" ADD CONSTRAINT "bitrix_employees_moy_sklad_id_fkey"
    FOREIGN KEY ("moy_sklad_id") REFERENCES "moy_sklad_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
