/*
  Warnings:

  - Added the required column `engeneer_salary` to the `roapp_service_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "roapp_service_orders" ADD COLUMN     "engeneer_salary" INTEGER NOT NULL;
