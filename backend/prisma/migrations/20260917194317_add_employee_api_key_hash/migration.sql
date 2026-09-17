-- AlterTable
ALTER TABLE "bitrix_employees" ADD COLUMN     "api_key_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bitrix_employees_api_key_hash_key" ON "bitrix_employees"("api_key_hash");
