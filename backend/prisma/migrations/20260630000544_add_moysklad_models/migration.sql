/*
  Warnings:

  - You are about to drop the `moySklad_nomenclature_embeddings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "moySklad_nomenclature_embeddings";

-- CreateTable
CREATE TABLE "moy_sklad_employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "middle_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "moy_sklad_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moy_sklad_product_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path_name" TEXT NOT NULL,
    "parent_id" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "moy_sklad_product_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moy_sklad_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "article" TEXT,
    "description" TEXT,
    "sale_price" INTEGER NOT NULL,
    "buy_price" INTEGER NOT NULL,
    "folder_id" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moy_sklad_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moy_sklad_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sale_price" INTEGER NOT NULL,
    "folder_id" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moy_sklad_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moy_sklad_demands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "moment" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "sum" INTEGER NOT NULL,
    "payed_sum" INTEGER NOT NULL,
    "agent_id" TEXT,
    "agent_name" TEXT,
    "state_id" TEXT,
    "state_name" TEXT,
    "sales_channel_id" TEXT,
    "sales_channel_name" TEXT,
    "online_manager_id" TEXT,
    "offline_manager_id" TEXT,
    "customer_order_id" TEXT,
    "description" TEXT,

    CONSTRAINT "moy_sklad_demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moy_sklad_demand_positions" (
    "id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "product_id" TEXT,
    "service_id" TEXT,
    "assortment_name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" INTEGER NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sum" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "profit" INTEGER NOT NULL,

    CONSTRAINT "moy_sklad_demand_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moy_sklad_demands_moment_idx" ON "moy_sklad_demands"("moment");

-- CreateIndex
CREATE INDEX "moy_sklad_demands_online_manager_id_idx" ON "moy_sklad_demands"("online_manager_id");

-- CreateIndex
CREATE INDEX "moy_sklad_demands_offline_manager_id_idx" ON "moy_sklad_demands"("offline_manager_id");

-- CreateIndex
CREATE INDEX "moy_sklad_demands_sales_channel_id_idx" ON "moy_sklad_demands"("sales_channel_id");

-- CreateIndex
CREATE INDEX "moy_sklad_demand_positions_demand_id_idx" ON "moy_sklad_demand_positions"("demand_id");

-- CreateIndex
CREATE INDEX "moy_sklad_demand_positions_product_id_idx" ON "moy_sklad_demand_positions"("product_id");

-- CreateIndex
CREATE INDEX "moy_sklad_demand_positions_service_id_idx" ON "moy_sklad_demand_positions"("service_id");

-- AddForeignKey
ALTER TABLE "moy_sklad_product_folders" ADD CONSTRAINT "moy_sklad_product_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "moy_sklad_product_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moy_sklad_products" ADD CONSTRAINT "moy_sklad_products_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "moy_sklad_product_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moy_sklad_services" ADD CONSTRAINT "moy_sklad_services_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "moy_sklad_product_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moy_sklad_demands" ADD CONSTRAINT "moy_sklad_demands_online_manager_id_fkey" FOREIGN KEY ("online_manager_id") REFERENCES "moy_sklad_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moy_sklad_demands" ADD CONSTRAINT "moy_sklad_demands_offline_manager_id_fkey" FOREIGN KEY ("offline_manager_id") REFERENCES "moy_sklad_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moy_sklad_demand_positions" ADD CONSTRAINT "moy_sklad_demand_positions_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "moy_sklad_demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moy_sklad_demand_positions" ADD CONSTRAINT "moy_sklad_demand_positions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "moy_sklad_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moy_sklad_demand_positions" ADD CONSTRAINT "moy_sklad_demand_positions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "moy_sklad_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
