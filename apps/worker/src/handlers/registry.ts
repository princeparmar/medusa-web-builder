import type { Job } from "bullmq"
import {
  syncBuiltinSections,
  syncPluginsCatalogToDb,
  refreshLatestVersionsFromGithub,
  refreshPluginLatestVersionsFromNpm,
} from "@mwb/registry"
import type { RegistrySyncJob } from "@mwb/core/queue"

export async function handleRegistrySync(job: Job<RegistrySyncJob>) {
  const { type } = job.data

  switch (type) {
    case "sections": {
      const count = await syncBuiltinSections()
      await job.log(`Imported ${count} sections from built-in catalog`)
      break
    }
    case "refresh-versions": {
      const sections = await refreshLatestVersionsFromGithub()
      const plugins = await refreshPluginLatestVersionsFromNpm()
      await job.log(`Refreshed ${sections} section versions and ${plugins} plugin versions`)
      break
    }
    case "plugins": {
      const count = await syncPluginsCatalogToDb()
      await job.log(`Imported ${count} plugins from built-in catalog`)
      break
    }
    case "github-repo":
    case "github-plugins-repo":
      await job.log("Online repo sync is disabled — use the admin panel to register packages")
      break
    default:
      throw new Error(`Unknown registry job type: ${type}`)
  }
}
