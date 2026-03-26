-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_assigned_by_id_fkey";

-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_stage_id_fkey";

-- AlterTable
ALTER TABLE "bitrix_deals" ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "stage_id" DROP NOT NULL,
ALTER COLUMN "assigned_by_id" DROP NOT NULL,
ALTER COLUMN "contact_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "bitrix_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "bitrix_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
