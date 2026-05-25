/*
  Warnings:

  - You are about to drop the `nomenclature_embeddings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "nomenclature_embeddings";

-- CreateTable
CREATE TABLE "moySklad_nomenclature_embeddings" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moySklad_nomenclature_embeddings_pkey" PRIMARY KEY ("id")
);
