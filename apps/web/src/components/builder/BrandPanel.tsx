"use client"

import type { ReactNode } from "react"
import { ImageUploadField } from "@/components/ImageUploadField"
import { ColorField } from "@/components/ColorField"
import { FontSelectField } from "@/components/FontSelectField"
import {
  BRAND_COLOR_FIELDS,
  BRAND_FONT_FIELDS,
  BRAND_IMAGE_SLOTS,
  DEFAULT_BRAND_COLORS,
  DEFAULT_BRAND_FONTS,
  type BrandFontConfig,
} from "@/lib/brand-config"

function BrandSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h4 className="brand-panel-section-title">{title}</h4>
      {children}
    </section>
  )
}

export function BrandPanel({
  brand,
  onChange,
  projectId,
}: {
  brand: Record<string, unknown>
  onChange: (brand: Record<string, unknown>) => void
  projectId: string
}) {
  const colors = { ...DEFAULT_BRAND_COLORS, ...((brand.colors as Record<string, string>) ?? {}) }
  const rawFonts = (brand.fonts as Record<string, unknown>) ?? {}

  function update(key: string, value: string) {
    onChange({ ...brand, [key]: value })
  }

  function updateColor(key: string, value: string) {
    onChange({ ...brand, colors: { ...colors, [key]: value } })
  }

  function updateFont(key: string, config: BrandFontConfig) {
    onChange({ ...brand, fonts: { ...rawFonts, [key]: config } })
  }

  return (
    <div className="brand-panel">
      <h3 style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>Brand settings</h3>

      <BrandSection title="Identity">
        <div className="form-group">
          <label>Company name</label>
          <input
            value={String(brand.companyName ?? "")}
            onChange={(e) => update("companyName", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Contact email</label>
          <input
            value={String(brand.contactEmail ?? "")}
            onChange={(e) => update("contactEmail", e.target.value)}
          />
        </div>
      </BrandSection>

      <BrandSection title="Brand images">
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
          Up to 5 images — uploaded via your Medusa backend.
        </p>
        {BRAND_IMAGE_SLOTS.map((slot) => (
          <ImageUploadField
            key={slot.key}
            projectId={projectId}
            label={slot.label}
            value={String(brand[slot.key] ?? "")}
            onChange={(url) => update(slot.key, url)}
          />
        ))}
      </BrandSection>

      <BrandSection title="Colors">
        {BRAND_COLOR_FIELDS.map((field) => (
          <ColorField
            key={field.key}
            label={field.label}
            value={colors[field.key] ?? DEFAULT_BRAND_COLORS[field.key]}
            fallback={DEFAULT_BRAND_COLORS[field.key]}
            onChange={(hex) => updateColor(field.key, hex)}
          />
        ))}
      </BrandSection>

      <BrandSection title="Typography">
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
          Choose a preset, load a Google Font, or upload a font file (.woff2, .woff, .ttf, .otf) for each text style.
        </p>
        {BRAND_FONT_FIELDS.map((field) => (
          <FontSelectField
            key={field.key}
            projectId={projectId}
            label={field.label}
            value={rawFonts[field.key] ?? DEFAULT_BRAND_FONTS[field.key]}
            onChange={(config) => updateFont(field.key, config)}
          />
        ))}
      </BrandSection>
    </div>
  )
}
