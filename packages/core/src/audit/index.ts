import { prisma, type Prisma } from "@mwb/db"

export async function logAudit(params: {
  userId?: string
  projectId?: string
  action: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      projectId: params.projectId,
      action: params.action,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
    },
  })
}
