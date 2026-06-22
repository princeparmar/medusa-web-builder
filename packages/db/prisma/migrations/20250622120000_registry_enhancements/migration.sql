-- AlterTable
ALTER TABLE "SectionRegistry" ADD COLUMN "latestVersion" TEXT;
ALTER TABLE "SectionRegistry" ADD COLUMN "componentType" TEXT NOT NULL DEFAULT 'segment';
ALTER TABLE "SectionRegistry" ADD COLUMN "category" TEXT;
ALTER TABLE "SectionRegistry" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "PluginRegistry" ADD COLUMN "latestVersion" TEXT;

-- CreateTable
CREATE TABLE "SectionSource" (
    "id" TEXT NOT NULL,
    "githubRepo" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectionSource_githubRepo_key" ON "SectionSource"("githubRepo");
