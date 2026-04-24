/*
  Warnings:

  - You are about to drop the column `source_id` on the `bitrix_deals` table. All the data in the column will be lost.
  - You are about to drop the `bitrix_sources` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_device_type_id_fkey";

-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_lead_source_id_fkey";

-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_source_id_fkey";

-- AlterTable
ALTER TABLE "bitrix_deals" DROP COLUMN "source_id",
ADD COLUMN     "point_of_contact_id" TEXT;

-- DropTable
DROP TABLE "bitrix_sources";

-- CreateTable
CREATE TABLE "bitrix_point_of_contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,

    CONSTRAINT "bitrix_point_of_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_device_types" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "bitrix_device_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_lead_sources" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "bitrix_lead_sources_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_point_of_contact_id_fkey" FOREIGN KEY ("point_of_contact_id") REFERENCES "bitrix_point_of_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "bitrix_lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_device_type_id_fkey" FOREIGN KEY ("device_type_id") REFERENCES "bitrix_device_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
