import type { Job } from "bullmq"
import {
  syncBuiltinSections,
  syncSectionsFromPath,
  registerCustomGithubRepo,
  syncDefaultStorefrontComponents,
  refreshLatestVersionsFromGithub,
  syncPluginsFromPath,
  syncDefaultPlugins,
  registerCustomPluginGithubRepo,
} from "@mwb/registry"
import type { RegistrySyncJob } from "@mwb/core/queue"

export async function handleRegistrySync(job: Job<RegistrySyncJob>) {
  const { type, githubRepo, branch } = job.data

  switch (type) {
    case "sections": {
      const path = process.env.STOREFRONT_COMPONENTS_PATH
      const count = path ? await syncSectionsFromPath(path) : await syncDefaultStorefrontComponents()
      await job.log(`Synced ${count} sections`)
      break
    }
    case "refresh-versions": {
      const count = await refreshLatestVersionsFromGithub()
      await job.log(`Refreshed ${count} section versions`)
      break
    }
    case "plugins": {
      const path = process.env.MEDUSA_PLUGINS_PATH
      const count = path ? await syncPluginsFromPath(path) : await syncDefaultPlugins()
      await job.log(`Synced ${count} plugins`)
      break
    }
    case "github-repo": {
      if (!githubRepo) throw new Error("githubRepo required")
      const count = await registerCustomGithubRepo(githubRepo, branch)
      await job.log(`Synced ${count} sections from ${githubRepo}`)
      break
    }
    case "github-plugins-repo": {
      if (!githubRepo) throw new Error("githubRepo required")
      const count = await registerCustomPluginGithubRepo(githubRepo, branch)
      await job.log(`Synced ${count} plugins from ${githubRepo}`)
      break
    }
    default:
      throw new Error(`Unknown registry job type: ${type}`)
  }
}
