-- AlterTable
ALTER TABLE "roapp_service" ADD COLUMN     "brand_id" INTEGER,
ADD COLUMN     "device_id" INTEGER,
ADD COLUMN     "series_id" INTEGER,
ADD COLUMN     "service_type_id" INTEGER,
ADD COLUMN     "work_type_id" INTEGER;

-- AlterTable
ALTER TABLE "roapp_service_categories" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "roapp_service_brand_id_idx" ON "roapp_service"("brand_id");

-- CreateIndex
CREATE INDEX "roapp_service_device_id_idx" ON "roapp_service"("device_id");

-- CreateIndex
CREATE INDEX "roapp_service_service_type_id_idx" ON "roapp_service"("service_type_id");

-- CreateIndex
CREATE INDEX "roapp_service_series_id_idx" ON "roapp_service"("series_id");

-- AddForeignKey
ALTER TABLE "roapp_service" ADD CONSTRAINT "roapp_service_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "roapp_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service" ADD CONSTRAINT "roapp_service_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "roapp_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service" ADD CONSTRAINT "roapp_service_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "roapp_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service" ADD CONSTRAINT "roapp_service_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "roapp_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service" ADD CONSTRAINT "roapp_service_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "roapp_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
