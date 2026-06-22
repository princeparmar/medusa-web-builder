"use client"

export function BrandPanel({
  brand,
  onChange,
}: {
  brand: Record<string, unknown>
  onChange: (brand: Record<string, unknown>) => void
  projectId: string
}) {
  const colors = (brand.colors as Record<string, string>) ?? {}

  function update(key: string, value: string) {
    onChange({ ...brand, [key]: value })
  }

  function updateColor(key: string, value: string) {
    onChange({ ...brand, colors: { ...colors, [key]: value } })
  }

  return (
    <div>
      <h3 style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>Brand settings</h3>
      <div className="form-group">
        <label>Company name</label>
        <input
          value={String(brand.companyName ?? "")}
          onChange={(e) => update("companyName", e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Logo URL</label>
        <input
          value={String(brand.logoUrl ?? "")}
          onChange={(e) => update("logoUrl", e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Contact email</label>
        <input
          value={String(brand.contactEmail ?? "")}
          onChange={(e) => update("contactEmail", e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Primary color</label>
        <input
          type="color"
          value={colors.primary ?? "#1a1a2e"}
          onChange={(e) => updateColor("primary", e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Secondary color</label>
        <input
          type="color"
          value={colors.secondary ?? "#e94560"}
          onChange={(e) => updateColor("secondary", e.target.value)}
        />
      </div>
    </div>
  )
}
