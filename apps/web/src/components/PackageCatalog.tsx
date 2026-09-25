"use client"

import { useMemo, useState } from "react"
import type { CatalogPackage } from "@/lib/catalog-packages"

type Props = {
  packages: CatalogPackage[]
}

export function PackageCatalog({ packages }: Props) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<"all" | "SECTION" | "PLUGIN">("all")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return packages.filter((p) => {
      if (kind !== "all" && p.kind !== kind) return false
      if (!q) return true
      const hay = [
        p.displayName,
        p.packageName,
        p.description,
        p.category,
        ...(p.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [packages, search, kind])

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          alignItems: "center",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search packages…"
          style={{ flex: "1 1 220px", maxWidth: 420 }}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "all" | "SECTION" | "PLUGIN")}
          style={{ width: "auto", minWidth: 160 }}
        >
          <option value="all">All packages</option>
          <option value="SECTION">UI components</option>
          <option value="PLUGIN">Backend plugins</option>
        </select>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          {filtered.length} of {packages.length}
        </span>
      </div>

      {packages.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--muted)" }}>No packages registered yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No packages match your search.</p>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filtered.map((p) => {
            const cover = p.media.find((m) => m.type === "IMAGE")
            return (
              <article
                key={`${p.kind}-${p.id}`}
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: cover ? "140px 1fr" : "1fr",
                  gap: "1rem",
                  alignItems: "start",
                }}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover.url}
                    alt=""
                    style={{
                      width: "100%",
                      height: 100,
                      objectFit: "cover",
                      borderRadius: "var(--radius)",
                      background: "var(--bg)",
                    }}
                  />
                ) : null}
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "baseline" }}>
                    <h2 style={{ fontSize: "1.125rem", margin: 0 }}>{p.displayName}</h2>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.125rem 0.5rem",
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        color: "var(--muted)",
                      }}
                    >
                      {p.kind === "SECTION" ? "UI" : "Plugin"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    <code>{p.packageName}</code>
                    {" · "}v{p.version}
                    {p.latestVersion && p.latestVersion !== p.version
                      ? ` · latest v${p.latestVersion}`
                      : ""}
                  </div>
                  {p.description ? (
                    <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>{p.description}</p>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      marginTop: "0.75rem",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {p.homepageUrl ? (
                      <a href={p.homepageUrl} target="_blank" rel="noreferrer">
                        Homepage
                      </a>
                    ) : null}
                    {p.githubRepo ? (
                      <a href={p.githubRepo} target="_blank" rel="noreferrer">
                        GitHub
                      </a>
                    ) : null}
                    {(p.tags ?? []).length > 0 ? (
                      <span style={{ color: "var(--muted)" }}>{p.tags.join(", ")}</span>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
