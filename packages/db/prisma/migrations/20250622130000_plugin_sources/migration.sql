-- AlterTable
ALTER TABLE "PluginRegistry" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PluginSource" (
    "id" TEXT NOT NULL,
    "githubRepo" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PluginSource_githubRepo_key" ON "PluginSource"("githubRepo");
