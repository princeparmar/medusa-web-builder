import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getAdminUser, isSuperAdmin } from "@/lib/auth-helpers"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/admin/login")
  }

  const admin = await getAdminUser(session.user.id)
  if (!admin?.isAdmin || !admin.adminRole) {
    redirect("/")
  }

  const superAdmin = isSuperAdmin(admin.adminRole)

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "0.75rem 1.5rem",
        }}
      >
        <div className="container" style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <strong>Admin</strong>
          <nav style={{ display: "flex", gap: "1rem", fontSize: "0.875rem" }}>
            <Link href="/admin/sections">UI components</Link>
            <Link href="/admin/plugins">Plugins</Link>
            {superAdmin ? <Link href="/admin/admins">Admins</Link> : null}
          </nav>
          <span style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--muted)" }}>
            {admin.email}
            {superAdmin ? " · Super admin" : " · Admin"}
          </span>
          <Link href="/" style={{ fontSize: "0.8125rem" }}>
            Catalog
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}
