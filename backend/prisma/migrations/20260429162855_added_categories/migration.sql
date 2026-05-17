/*
  Warnings:

  - You are about to drop the column `engeneer_salary` on the `roapp_orders` table. All the data in the column will be lost.
  - You are about to drop the column `engeneer_id` on the `roapp_products_orders` table. All the data in the column will be lost.
  - You are about to drop the column `engeneer_id` on the `roapp_service_orders` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bitrix_deal_id]` on the table `roapp_orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `engineer_id` to the `roapp_products_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `engineer_id` to the `roapp_service_orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "roapp_products_orders" DROP CONSTRAINT "roapp_products_orders_engeneer_id_fkey";

-- DropForeignKey
ALTER TABLE "roapp_service_orders" DROP CONSTRAINT "roapp_service_orders_engeneer_id_fkey";

-- AlterTable
ALTER TABLE "roapp_orders" DROP COLUMN "engeneer_salary",
ADD COLUMN     "engineer_salary" INTEGER;

-- AlterTable
ALTER TABLE "roapp_products" ADD COLUMN     "category_id" INTEGER,
ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "roapp_products_id_seq";

-- AlterTable
ALTER TABLE "roapp_products_orders" DROP COLUMN "engeneer_id",
ADD COLUMN     "engineer_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "roapp_service" ADD COLUMN     "category_id" INTEGER,
ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "roapp_service_id_seq";

-- AlterTable
ALTER TABLE "roapp_service_orders" DROP COLUMN "engeneer_id",
ADD COLUMN     "engineer_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "roapp_service_categories" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,

    CONSTRAINT "roapp_service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_product_categories" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,

    CONSTRAINT "roapp_product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roapp_service_categories_parent_id_idx" ON "roapp_service_categories"("parent_id");

-- CreateIndex
CREATE INDEX "roapp_product_categories_parent_id_idx" ON "roapp_product_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "roapp_orders_bitrix_deal_id_key" ON "roapp_orders"("bitrix_deal_id");

-- CreateIndex
CREATE INDEX "roapp_products_category_id_idx" ON "roapp_products"("category_id");

-- CreateIndex
CREATE INDEX "roapp_service_category_id_idx" ON "roapp_service"("category_id");

-- AddForeignKey
ALTER TABLE "roapp_products" ADD CONSTRAINT "roapp_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "roapp_product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service" ADD CONSTRAINT "roapp_service_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "roapp_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service_categories" ADD CONSTRAINT "roapp_service_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "roapp_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_product_categories" ADD CONSTRAINT "roapp_product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "roapp_product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_orders" ADD CONSTRAINT "roapp_orders_bitrix_deal_id_fkey" FOREIGN KEY ("bitrix_deal_id") REFERENCES "bitrix_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_products_orders" ADD CONSTRAINT "roapp_products_orders_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "roapp_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service_orders" ADD CONSTRAINT "roapp_service_orders_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "roapp_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
