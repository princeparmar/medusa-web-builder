-- Admin roles
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');
CREATE TYPE "CatalogKind" AS ENUM ('SECTION', 'PLUGIN');
CREATE TYPE "CatalogMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminRole" "AdminRole";

-- Promote existing admins to SUPER_ADMIN
UPDATE "User" SET "adminRole" = 'SUPER_ADMIN' WHERE "isAdmin" = true AND "adminRole" IS NULL;

-- Catalog listing fields on sections
ALTER TABLE "SectionRegistry" ADD COLUMN IF NOT EXISTS "homepageUrl" TEXT;
ALTER TABLE "SectionRegistry" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Catalog listing fields on plugins
ALTER TABLE "PluginRegistry" ADD COLUMN IF NOT EXISTS "homepageUrl" TEXT;
ALTER TABLE "PluginRegistry" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Version history
CREATE TABLE IF NOT EXISTS "CatalogPackageVersion" (
    "id" TEXT NOT NULL,
    "kind" "CatalogKind" NOT NULL,
    "registryId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogPackageVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogPackageVersion_kind_registryId_version_key"
  ON "CatalogPackageVersion"("kind", "registryId", "version");

CREATE INDEX IF NOT EXISTS "CatalogPackageVersion_kind_registryId_idx"
  ON "CatalogPackageVersion"("kind", "registryId");

-- Media
CREATE TABLE IF NOT EXISTS "CatalogMedia" (
    "id" TEXT NOT NULL,
    "kind" "CatalogKind" NOT NULL,
    "registryId" TEXT NOT NULL,
    "type" "CatalogMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CatalogMedia_kind_registryId_idx"
  ON "CatalogMedia"("kind", "registryId");

-- Backfill version history from existing registry rows
INSERT INTO "CatalogPackageVersion" ("id", "kind", "registryId", "version", "createdAt")
SELECT gen_random_uuid()::text, 'SECTION', "id", "version", CURRENT_TIMESTAMP
FROM "SectionRegistry" s
WHERE NOT EXISTS (
  SELECT 1 FROM "CatalogPackageVersion" v
  WHERE v."kind" = 'SECTION' AND v."registryId" = s."id" AND v."version" = s."version"
);

INSERT INTO "CatalogPackageVersion" ("id", "kind", "registryId", "version", "createdAt")
SELECT gen_random_uuid()::text, 'PLUGIN', "id", "version", CURRENT_TIMESTAMP
FROM "PluginRegistry" p
WHERE NOT EXISTS (
  SELECT 1 FROM "CatalogPackageVersion" v
  WHERE v."kind" = 'PLUGIN' AND v."registryId" = p."id" AND v."version" = p."version"
);
