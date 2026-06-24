import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/admin/login")
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard")
  }

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
            <Link href="/admin/operations">Operations</Link>
            <Link href="/admin/sections">Sections</Link>
            <Link href="/admin/plugins">Plugins</Link>
          </nav>
          <span style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--muted)" }}>
            {session.user.email}
          </span>
          <Link href="/dashboard" style={{ fontSize: "0.8125rem" }}>
            Shop builder
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}
