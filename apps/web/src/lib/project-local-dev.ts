import { existsSync } from "fs"
import { resolve } from "path"
import { getShopLocalStatus, type LocalRunState } from "@mwb/core/shops"

export async function getProjectLocalDevStatus(
  workspacePath: string | null | undefined
): Promise<LocalRunState | null> {
  if (!workspacePath || !existsSync(workspacePath)) return null
  return getShopLocalStatus(resolve(workspacePath))
}

export function isLocalDevRunning(state: LocalRunState | null | undefined): boolean {
  return state?.status === "running"
}
