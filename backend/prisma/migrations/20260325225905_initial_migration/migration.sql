-- CreateTable
CREATE TABLE "bitrix_deals" (
    "id" INTEGER NOT NULL,
    "title" TEXT,
    "opportunity" INTEGER,
    "stage_id" TEXT,
    "assigned_by_id" INTEGER,
    "contact_id" INTEGER,
    "source_id" TEXT,
    "lead_source_id" INTEGER,
    "brand_id" INTEGER,
    "device_type_id" INTEGER,
    "device_model" TEXT,
    "device_malfunction" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "bitrix_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_employees" (
    "id" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,

    CONSTRAINT "bitrix_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_enum_values" (
    "id" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,

    CONSTRAINT "bitrix_enum_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "system_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,

    CONSTRAINT "bitrix_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,

    CONSTRAINT "bitrix_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bitrix_deals_id_key" ON "bitrix_deals"("id");

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "bitrix_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "bitrix_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "bitrix_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "bitrix_enum_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "bitrix_enum_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_deals" ADD CONSTRAINT "bitrix_deals_device_type_id_fkey" FOREIGN KEY ("device_type_id") REFERENCES "bitrix_enum_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
