import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"

export async function GET() {
  const { error, admin } = await requireAdmin()
  if (error) return error

  return NextResponse.json({
    user: {
      id: admin!.id,
      email: admin!.email,
      name: admin!.name,
      isAdmin: admin!.isAdmin,
      adminRole: admin!.adminRole,
    },
  })
}
