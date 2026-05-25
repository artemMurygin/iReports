-- CreateTable
CREATE TABLE "bitrix_installations" (
    "id" SERIAL NOT NULL,
    "member_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "client_endpoint" TEXT NOT NULL,
    "server_endpoint" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bitrix_installations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bitrix_installations_member_id_key" ON "bitrix_installations"("member_id");
