-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'PDF', 'DOC', 'IMPORT');

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" "AssetKind" NOT NULL DEFAULT 'IMAGE',
    "publicUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assets_bucketKey_key" ON "assets"("bucketKey");
CREATE INDEX "assets_tenantId_kind_idx" ON "assets"("tenantId", "kind");
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
