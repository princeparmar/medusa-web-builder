import Link from "next/link"
import { auth } from "@/auth"
import { listCatalogPackages } from "@/lib/catalog-packages"
import { PackageCatalog } from "@/components/PackageCatalog"

export default async function HomePage() {
  const [session, packages] = await Promise.all([auth(), listCatalogPackages()])

  return (
    <main className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem", maxWidth: 960 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: "1rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "0.35rem" }}>Package catalog</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Published npm UI components and backend plugins available for shops.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {session?.user?.isAdmin ? (
            <Link href="/admin/sections" className="btn btn-primary">
              Admin
            </Link>
          ) : (
            <Link href="/admin/login" className="btn btn-secondary">
              Admin sign in
            </Link>
          )}
        </div>
      </header>

      <PackageCatalog packages={packages} />
    </main>
  )
}
