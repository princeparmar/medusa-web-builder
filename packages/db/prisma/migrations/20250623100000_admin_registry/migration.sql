-- Admin users and plugin category for manual registry
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PluginRegistry" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "PluginRegistry" ALTER COLUMN "githubRepo" DROP NOT NULL;
