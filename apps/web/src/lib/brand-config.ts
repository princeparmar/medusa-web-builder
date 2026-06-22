import type { CSSProperties } from "react"

export const BRAND_COLOR_FIELDS = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted text" },
] as const

export const DEFAULT_BRAND_COLORS: Record<string, string> = {
  primary: "#1a1a2e",
  secondary: "#e94560",
  accent: "#0f3460",
  background: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
}

export const BRAND_IMAGE_SLOTS = [
  { key: "logoUrl", label: "Logo" },
  { key: "logoUrlLight", label: "Logo (light background)" },
  { key: "faviconUrl", label: "Favicon" },
  { key: "ogImageUrl", label: "Social / OG image" },
  { key: "watermarkUrl", label: "Watermark / badge" },
] as const

export const BRAND_FONT_FIELDS = [
  { key: "h1", label: "Heading 1 (H1)" },
  { key: "h2", label: "Heading 2 (H2)" },
  { key: "h3", label: "Heading 3 (H3)" },
  { key: "h4", label: "Heading 4 (H4)" },
  { key: "h5", label: "Heading 5 (H5)" },
  { key: "h6", label: "Heading 6 (H6)" },
  { key: "title", label: "Page title" },
  { key: "body", label: "Body / paragraph" },
  { key: "bullet", label: "Bullet lists" },
] as const

export const DEFAULT_BRAND_FONTS: Record<string, string> = {
  h1: "Inter",
  h2: "Inter",
  h3: "Inter",
  h4: "Inter",
  h5: "Inter",
  h6: "Inter",
  title: "Inter",
  body: "Inter",
  bullet: "Inter",
}

/** System / web-safe presets (no CDN load). */
export const FONT_FAMILY_PRESETS = [
  "Inter",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
] as const

/** Popular Google Fonts — loaded via fonts.googleapis.com when selected. */
export const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Raleway",
  "Oswald",
  "Merriweather",
  "Playfair Display",
  "Libre Baskerville",
  "DM Sans",
  "Outfit",
  "Work Sans",
  "Source Sans 3",
  "Rubik",
  "Ubuntu",
  "Crimson Text",
  "Fira Sans",
  "PT Sans",
  "Noto Sans",
  "Manrope",
  "Space Grotesk",
  "Plus Jakarta Sans",
] as const

export type BrandFontSource = "preset" | "google" | "file"

export type BrandFontFormat = "woff2" | "woff" | "ttf" | "otf"

export type BrandFontConfig = {
  source: BrandFontSource
  family: string
  /** Google Fonts weight subset, e.g. "400;500;600;700" */
  weights?: string
  fileUrl?: string
  fileFormat?: BrandFontFormat
}

const DEFAULT_GOOGLE_WEIGHTS = "400;500;600;700"

export function normalizeFontConfig(value: unknown, fallbackFamily = "Inter"): BrandFontConfig {
  if (typeof value === "string") {
    const family = value.trim() || fallbackFamily
    return { source: "preset", family }
  }

  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>
    const source = (v.source as BrandFontSource) ?? "preset"
    const family = String(v.family ?? fallbackFamily).trim() || fallbackFamily
    return {
      source,
      family,
      weights: v.weights ? String(v.weights) : undefined,
      fileUrl: v.fileUrl ? String(v.fileUrl) : undefined,
      fileFormat: v.fileFormat as BrandFontFormat | undefined,
    }
  }

  return { source: "preset", family: fallbackFamily }
}

export function fontFormatFromFilename(name: string): BrandFontFormat {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext === "woff2") return "woff2"
  if (ext === "woff") return "woff"
  if (ext === "otf") return "otf"
  return "ttf"
}

export function fontFamilyCss(config: BrandFontConfig): string {
  const family = config.family.replace(/"/g, '\\"')
  return `"${family}", system-ui, sans-serif`
}

function cssFontFormat(format: BrandFontFormat): string {
  if (format === "woff2") return "woff2"
  if (format === "woff") return "woff"
  if (format === "otf") return "opentype"
  return "truetype"
}

export function buildBrandFontAssets(brand: Record<string, unknown>): {
  googleLink?: string
  styleBlock: string
} {
  const fonts = (brand.fonts as Record<string, unknown>) ?? {}
  const googleFamilies = new Map<string, Set<string>>()
  const faceRules: string[] = []
  const vars: string[] = []

  for (const { key } of BRAND_FONT_FIELDS) {
    const config = normalizeFontConfig(fonts[key], DEFAULT_BRAND_FONTS[key])
    vars.push(`--preview-font-${key}: ${fontFamilyCss(config)}`)

    if (config.source === "google" && config.family) {
      const weights = (config.weights ?? DEFAULT_GOOGLE_WEIGHTS).split(";").filter(Boolean)
      if (!googleFamilies.has(config.family)) googleFamilies.set(config.family, new Set())
      for (const w of weights) googleFamilies.get(config.family)!.add(w.trim())
    }

    if (config.source === "file" && config.fileUrl && config.family) {
      const format = config.fileFormat ?? "woff2"
      faceRules.push(
        `@font-face{font-family:"${config.family.replace(/"/g, '\\"')}";src:url("${config.fileUrl}") format("${cssFontFormat(format)}");font-display:swap;font-weight:100 900;font-style:normal;}`
      )
    }
  }

  let googleLink: string | undefined
  if (googleFamilies.size > 0) {
    const params = [...googleFamilies.entries()]
      .map(([family, weights]) => {
        const name = family.trim().replace(/\s+/g, "+")
        const w = [...weights].sort((a, b) => Number(a) - Number(b)).join(";")
        return `family=${name}:wght@${w}`
      })
      .join("&")
    googleLink = `https://fonts.googleapis.com/css2?${params}&display=swap`
  }

  const styleBlock = [...faceRules, `:root{${vars.join(";")}}`].filter(Boolean).join("\n")
  return { googleLink, styleBlock }
}

export function normalizeHexColor(value: string, fallback = "#000000"): string {
  const v = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const [, r, g, b] = v
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v}`.toLowerCase()
  return fallback
}

export function isValidHexColor(value: string): boolean {
  const v = value.trim()
  return /^#?[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(v)
}

export function brandPreviewStyle(brand: Record<string, unknown>): CSSProperties {
  const colors = (brand.colors as Record<string, string>) ?? {}
  const fonts = (brand.fonts as Record<string, unknown>) ?? {}
  const style: Record<string, string> = {}

  for (const { key } of BRAND_COLOR_FIELDS) {
    const c = colors[key]
    if (c) style[`--preview-color-${key}`] = normalizeHexColor(c, c)
  }

  for (const { key } of BRAND_FONT_FIELDS) {
    const config = normalizeFontConfig(fonts[key], DEFAULT_BRAND_FONTS[key])
    if (config.family) style[`--preview-font-${key}`] = fontFamilyCss(config)
  }

  if (colors.background) style.background = normalizeHexColor(colors.background, colors.background)
  if (colors.text) style.color = normalizeHexColor(colors.text, colors.text)

  return style as CSSProperties
}

export function getBrandFonts(brand: Record<string, unknown>): Record<string, BrandFontConfig> {
  const raw = (brand.fonts as Record<string, unknown>) ?? {}
  const out: Record<string, BrandFontConfig> = {}
  for (const { key } of BRAND_FONT_FIELDS) {
    out[key] = normalizeFontConfig(raw[key], DEFAULT_BRAND_FONTS[key])
  }
  return out
}
