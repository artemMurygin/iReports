-- CreateTable
CREATE TABLE "roapp_employees" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,

    CONSTRAINT "roapp_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_order_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "roapp_order_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_marketing_sources" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "roapp_marketing_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_order_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "color" VARCHAR(255) NOT NULL,
    "grup_name" VARCHAR(255) NOT NULL,

    CONSTRAINT "roapp_order_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "engeneer_bonus" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "roapp_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_service" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "engeneer_bonus" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "warranty" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "in_catalog" BOOLEAN NOT NULL,

    CONSTRAINT "roapp_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_orders" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "bitrix_deal_id" INTEGER,
    "client_id" INTEGER,
    "status_id" INTEGER NOT NULL,
    "manager_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "closed_by_id" INTEGER,
    "order_type_id" INTEGER NOT NULL,
    "ad_campaign_id" INTEGER,
    "malfunction" VARCHAR(255),
    "discount_sum" INTEGER,
    "payed" INTEGER,
    "cost" INTEGER,
    "engeneer_salary" INTEGER,
    "manager_salary" INTEGER,
    "device_brand" VARCHAR(255),
    "device_model" VARCHAR(255),
    "device_serial" VARCHAR(255),
    "device_color" VARCHAR(255),
    "fail_reason" VARCHAR(255),
    "service_supplier_name" VARCHAR(255),
    "online_manager" VARCHAR(255),
    "due_date" DATE,
    "done_at" DATE,
    "closed_at" DATE,
    "modified_at" DATE,
    "created_at" DATE,

    CONSTRAINT "roapp_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_products_orders" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "engeneer_id" INTEGER NOT NULL,

    CONSTRAINT "roapp_products_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_service_orders" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "in_catalog" BOOLEAN NOT NULL,
    "engeneer_id" INTEGER NOT NULL,

    CONSTRAINT "roapp_service_orders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "roapp_orders" ADD CONSTRAINT "roapp_orders_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "roapp_order_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_orders" ADD CONSTRAINT "roapp_orders_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "roapp_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_orders" ADD CONSTRAINT "roapp_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "roapp_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_orders" ADD CONSTRAINT "roapp_orders_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "roapp_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_orders" ADD CONSTRAINT "roapp_orders_order_type_id_fkey" FOREIGN KEY ("order_type_id") REFERENCES "roapp_order_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_orders" ADD CONSTRAINT "roapp_orders_ad_campaign_id_fkey" FOREIGN KEY ("ad_campaign_id") REFERENCES "roapp_marketing_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_products_orders" ADD CONSTRAINT "roapp_products_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "roapp_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_products_orders" ADD CONSTRAINT "roapp_products_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "roapp_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_products_orders" ADD CONSTRAINT "roapp_products_orders_engeneer_id_fkey" FOREIGN KEY ("engeneer_id") REFERENCES "roapp_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service_orders" ADD CONSTRAINT "roapp_service_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "roapp_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service_orders" ADD CONSTRAINT "roapp_service_orders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "roapp_service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roapp_service_orders" ADD CONSTRAINT "roapp_service_orders_engeneer_id_fkey" FOREIGN KEY ("engeneer_id") REFERENCES "roapp_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
