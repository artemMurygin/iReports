-- AlterTable
ALTER TABLE "bitrix_employees" ALTER COLUMN "roapp_online_name" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "motivation_schemas" (
    "id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motivation_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "motivation_schemas_target_type_target_id_idx" ON "motivation_schemas"("target_type", "target_id");
