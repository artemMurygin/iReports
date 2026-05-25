CREATE EXTENSION IF NOT EXISTS vector;
-- CreateTable
CREATE TABLE "nomenclature_embeddings" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nomenclature_embeddings_pkey" PRIMARY KEY ("id")
);
