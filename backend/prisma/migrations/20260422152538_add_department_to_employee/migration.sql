/*
  Warnings:

  - Added the required column `department` to the `bitrix_employees` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bitrix_employees" ADD COLUMN     "department" INTEGER NOT NULL;
