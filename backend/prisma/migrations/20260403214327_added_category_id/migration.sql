/*
  Warnings:

  - Added the required column `categoryId` to the `bitrix_deals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bitrix_deals" ADD COLUMN     "categoryId" INTEGER NOT NULL;
