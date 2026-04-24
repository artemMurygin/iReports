/*
  Warnings:

  - You are about to drop the `bitrix_point_of_contact` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bitrix_deals" DROP CONSTRAINT "bitrix_deals_point_of_contact_id_fkey";

-- DropTable
DROP TABLE "bitrix_point_of_contact";

-- CreateTable
CREATE TABLE "bitrix_point_of_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,

    CONSTRAINT "bitrix_point_of_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_point_of_contact_id_fkey" FOREIGN KEY ("point_of_contact_id") REFERENCES "bitrix_point_of_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
