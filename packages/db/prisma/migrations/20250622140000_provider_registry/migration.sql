-- CreateTable
CREATE TABLE "ProviderRegistry" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "requiresPlugin" TEXT,
    "medusaResolve" TEXT,
    "githubRepo" TEXT,
    "sourcePackage" TEXT,
    "settingsSchemaJson" JSONB NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderRegistry_module_providerId_key" ON "ProviderRegistry"("module", "providerId");
