import type { ProjectRole } from "@mwb/db"

const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  VIEWER: 1,
  DEVELOPER: 2,
  MANAGER: 3,
  OWNER: 4,
}

export const PERMISSIONS = {
  "project:read": ["VIEWER", "DEVELOPER", "MANAGER", "OWNER"] as ProjectRole[],
  "project:edit": ["DEVELOPER", "MANAGER", "OWNER"] as ProjectRole[],
  "project:publish": ["MANAGER", "OWNER"] as ProjectRole[],
  "project:invite": ["MANAGER", "OWNER"] as ProjectRole[],
  "project:delete": ["OWNER"] as ProjectRole[],
  "project:secrets": ["OWNER"] as ProjectRole[],
} as const

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(role: ProjectRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role)
}

export function hasMinRole(role: ProjectRole, minRole: ProjectRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole]
}
