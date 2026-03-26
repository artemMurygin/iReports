/*
  Warnings:

  - You are about to drop the column `device_model_id` on the `bitrix_deals` table. All the data in the column will be lost.
  - The primary key for the `bitrix_sources` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bitrix_stages` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_device_model_id_fkey";

-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_source_id_fkey";

-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_stage_id_fkey";

-- AlterTable
ALTER TABLE "bitrix_deals" DROP COLUMN "device_model_id",
ADD COLUMN     "device_model" TEXT,
ALTER COLUMN "stage_id" SET DATA TYPE TEXT,
ALTER COLUMN "source_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "bitrix_sources" DROP CONSTRAINT "bitrix_sources_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "bitrix_sources_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bitrix_stages" DROP CONSTRAINT "bitrix_stages_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "bitrix_stages_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "bitrix_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "bitrix_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
