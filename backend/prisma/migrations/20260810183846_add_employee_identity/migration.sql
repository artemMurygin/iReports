-- CreateEnum
CREATE TYPE "external_system" AS ENUM ('ROAPP', 'MOY_SKLAD');

-- CreateEnum
CREATE TYPE "employee_identity_type" AS ENUM ('EMPLOYEE_ID', 'ONLINE_MANAGER_FIELD');

-- CreateTable
CREATE TABLE "employee_identities" (
    "id" TEXT NOT NULL,
    "bitrix_employee_id" INTEGER NOT NULL,
    "system" "external_system" NOT NULL,
    "identifier_type" "employee_identity_type" NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_identities_bitrix_employee_id_idx" ON "employee_identities"("bitrix_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_identities_system_identifier_type_external_id_key" ON "employee_identities"("system", "identifier_type", "external_id");

-- AddForeignKey
ALTER TABLE "employee_identities" ADD CONSTRAINT "employee_identities_bitrix_employee_id_fkey" FOREIGN KEY ("bitrix_employee_id") REFERENCES "bitrix_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
