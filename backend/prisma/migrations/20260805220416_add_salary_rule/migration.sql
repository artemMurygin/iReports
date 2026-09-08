/*
  Warnings:

  - You are about to drop the column `rules` on the `motivation_schemas` table. All the data in that column will be lost.

*/
-- AlterTable
ALTER TABLE "motivation_schemas" DROP COLUMN "rules";

-- CreateTable
CREATE TABLE "salary_rules" (
    "id" TEXT NOT NULL,
    "motivation_schema_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "props" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_rules_motivation_schema_id_idx" ON "salary_rules"("motivation_schema_id");

-- AddForeignKey
ALTER TABLE "salary_rules" ADD CONSTRAINT "salary_rules_motivation_schema_id_fkey" FOREIGN KEY ("motivation_schema_id") REFERENCES "motivation_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
