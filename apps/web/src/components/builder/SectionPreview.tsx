"use client"

import { stripLayoutShells } from "@mwb/registry/layout-shell"

export function propStr(
  props: Record<string, unknown>,
  key: string,
  fallback = ""
): string {
  const v = props[key]
  if (v === undefined || v === null || v === "") return fallback
  return String(v)
}

export function segmentKind(packageName: string): string {
  const slug = packageName.split("/").pop() ?? packageName
  if (slug === "segment-nav") return "nav"
  if (slug === "segment-footer") return "footer"
  const short = slug.replace(/^segment-/, "")
  if (short.includes("hero") || (short.includes("banner") && short.includes("home"))) return "hero"
  if (slug.includes("nav")) return "nav"
  if (slug.includes("footer")) return "footer"
  if (slug.includes("promotional") || slug.includes("promo")) return "promo"
  if (
    slug.includes("best-seller") ||
    slug.includes("product-grid") ||
    slug.includes("product-carousel") ||
    slug.includes("featured-product")
  )
    return "products"
  if (slug.includes("categor")) return "categories"
  if (slug.includes("newsletter") || slug.includes("subscribe")) return "newsletter"
  if (slug.includes("testimonial") || slug.includes("review")) return "testimonials"
  if (slug.includes("cart")) return "cart"
  if (slug.includes("checkout")) return "checkout"
  return "generic"
}

type Brand = {
  companyName?: string
  logoUrl?: string
  colors?: { primary?: string; secondary?: string }
}

function HeroBlock({
  props,
  brand,
  variant,
}: {
  props: Record<string, unknown>
  brand: Brand
  variant: string
}) {
  const title = propStr(props, "homeBanner.title", "Welcome to your store")
  const subtitle = propStr(props, "homeBanner.subtitle", "")
  const description = propStr(
    props,
    "homeBanner.description",
    "Edit this hero in the section properties panel."
  )
  const image = propStr(props, "homeBanner.image", "")
  const button = propStr(props, "homeBanner.buttonName", "Shop now")
  const primary = brand.colors?.primary ?? "#1a1a2e"

  if (variant === "split") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 360 }}>
        <div
          style={{
            padding: "3rem 2.5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "#f9fafb",
          }}
        >
          {subtitle && (
            <span style={{ fontSize: "0.75rem", color: primary, fontWeight: 600, marginBottom: "0.5rem" }}>
              {subtitle}
            </span>
          )}
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#111827", marginBottom: "0.75rem", lineHeight: 1.2 }}>
            {title}
          </h1>
          <p style={{ color: "#6b7280", fontSize: "0.9375rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            {description}
          </p>
          <span
            style={{
              display: "inline-block",
              padding: "0.625rem 1.5rem",
              background: primary,
              color: "#fff",
              borderRadius: 6,
              fontSize: "0.875rem",
              fontWeight: 500,
              width: "fit-content",
            }}
          >
            {button}
          </span>
        </div>
        <div
          style={{
            background: image
              ? `url(${image}) center/cover`
              : `linear-gradient(135deg, ${primary}33, ${brand.colors?.secondary ?? "#e94560"}33)`,
            minHeight: 280,
          }}
        />
      </div>
    )
  }

  const centered = variant === "centered"
  return (
    <div
      style={{
        position: "relative",
        minHeight: centered ? 320 : 400,
        display: "flex",
        alignItems: "center",
        justifyContent: centered ? "center" : "flex-start",
        background: image
          ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${image}) center/cover`
          : `linear-gradient(135deg, ${primary}, ${brand.colors?.secondary ?? "#16213e"})`,
        padding: centered ? "3rem 2rem" : "3rem 2.5rem",
        textAlign: centered ? "center" : "left",
      }}
    >
      <div style={{ maxWidth: centered ? 560 : 520, color: "#fff" }}>
        {subtitle && (
          <span style={{ fontSize: "0.75rem", opacity: 0.85, fontWeight: 500, display: "block", marginBottom: "0.5rem" }}>
            {subtitle}
          </span>
        )}
        <h1 style={{ fontSize: centered ? "2.25rem" : "2.5rem", fontWeight: 700, marginBottom: "0.75rem", lineHeight: 1.15 }}>
          {title}
        </h1>
        <p style={{ opacity: 0.9, fontSize: "1rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>{description}</p>
        <span
          style={{
            display: "inline-block",
            padding: "0.625rem 1.5rem",
            background: "#fff",
            color: primary,
            borderRadius: 6,
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {button}
        </span>
      </div>
    </div>
  )
}

function NavBlock({ brand }: { brand: Brand }) {
  const name = brand.companyName ?? "Your Store"
  const logo = brand.logoUrl
  const primary = brand.colors?.primary ?? "#1a1a2e"

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.875rem 1.5rem",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontWeight: 700, color: primary }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" style={{ height: 28, objectFit: "contain" }} />
        ) : (
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: primary,
              display: "inline-block",
            }}
          />
        )}
        <span style={{ fontSize: "1rem" }}>{name}</span>
      </div>
      <nav style={{ display: "flex", gap: "1.25rem", fontSize: "0.8125rem", color: "#4b5563" }}>
        {["Shop", "Collections", "About", "Contact"].map((l) => (
          <span key={l}>{l}</span>
        ))}
      </nav>
      <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8125rem", color: "#6b7280" }}>
        <span>Search</span>
        <span>Cart (0)</span>
      </div>
    </header>
  )
}

function FooterBlock({ brand, props }: { brand: Brand; props: Record<string, unknown> }) {
  const primary = brand.colors?.primary ?? "#1a1a2e"
  const tagline = propStr(props, "tagline", propStr(props, "description", "Quality products, delivered with care."))

  return (
    <footer style={{ background: primary, color: "#e5e7eb", padding: "2.5rem 1.5rem 1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem", color: "#fff" }}>
            {brand.companyName ?? "Your Store"}
          </div>
          <p style={{ fontSize: "0.8125rem", opacity: 0.8, lineHeight: 1.6 }}>{tagline}</p>
        </div>
        {["Shop", "Support", "Company"].map((col) => (
          <div key={col}>
            <div style={{ fontWeight: 600, fontSize: "0.75rem", marginBottom: "0.75rem", color: "#fff" }}>{col}</div>
            {["Link one", "Link two", "Link three"].map((l) => (
              <div key={l} style={{ fontSize: "0.75rem", opacity: 0.7, marginBottom: "0.375rem" }}>
                {l}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "1rem", fontSize: "0.75rem", opacity: 0.6 }}>
        © {new Date().getFullYear()} {brand.companyName ?? "Your Store"}
      </div>
    </footer>
  )
}

function PromoBlock({ props, brand }: { props: Record<string, unknown>; brand: Brand }) {
  const primary = brand.colors?.primary ?? "#1a1a2e"
  const items = [0, 1, 2].map((i) => ({
    title: propStr(props, `banners.${i}.title`, propStr(props, `items.${i}.title`, `Promotion ${i + 1}`)),
    subtitle: propStr(props, `banners.${i}.subtitle`, propStr(props, `items.${i}.subtitle`, "Limited time offer")),
    image: propStr(props, `banners.${i}.image`, ""),
  }))

  return (
    <div style={{ padding: "2rem 1.5rem", background: "#f9fafb" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              borderRadius: 8,
              overflow: "hidden",
              background: "#fff",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                height: 140,
                background: item.image
                  ? `url(${item.image}) center/cover`
                  : `linear-gradient(135deg, ${primary}${i === 0 ? "" : "99"}, ${brand.colors?.secondary ?? "#e94560"}88)`,
              }}
            />
            <div style={{ padding: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827" }}>{item.title}</div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>{item.subtitle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductsBlock({ props, brand }: { props: Record<string, unknown>; brand: Brand }) {
  const title = propStr(props, "title", propStr(props, "sectionTitle", "Featured products"))
  const primary = brand.colors?.primary ?? "#1a1a2e"

  return (
    <div style={{ padding: "2rem 1.5rem" }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", marginBottom: "1.25rem", textAlign: "center" }}>
        {title}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
            <div
              style={{
                height: 160,
                background: `linear-gradient(180deg, #f3f4f6, #e5e7eb)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
                fontSize: "0.75rem",
              }}
            >
              Product image
            </div>
            <div style={{ padding: "0.75rem" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#111827" }}>Product name</div>
              <div style={{ fontSize: "0.8125rem", color: primary, fontWeight: 600, marginTop: "0.25rem" }}>
                $49.00
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoriesBlock({ props }: { props: Record<string, unknown> }) {
  const title = propStr(props, "title", "Shop by category")

  return (
    <div style={{ padding: "2rem 1.5rem", background: "#fff" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", marginBottom: "1.25rem", textAlign: "center" }}>
        {title}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {["Electronics", "Fashion", "Home", "Sports"].map((cat) => (
          <div key={cat} style={{ textAlign: "center" }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "#f3f4f6",
                margin: "0 auto 0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
              }}
            >
              ○
            </div>
            <span style={{ fontSize: "0.8125rem", color: "#374151" }}>{cat}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NewsletterBlock({ props, brand }: { props: Record<string, unknown>; brand: Brand }) {
  const title = propStr(props, "title", "Subscribe to our newsletter")
  const subtitle = propStr(props, "subtitle", "Get updates on new products and offers.")
  const primary = brand.colors?.primary ?? "#1a1a2e"

  return (
    <div style={{ padding: "2.5rem 1.5rem", background: "#f9fafb", textAlign: "center" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>{title}</h2>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1.25rem" }}>{subtitle}</p>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", maxWidth: 400, margin: "0 auto" }}>
        <div
          style={{
            flex: 1,
            padding: "0.625rem 0.875rem",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: "#9ca3af",
            background: "#fff",
            textAlign: "left",
          }}
        >
          Enter your email
        </div>
        <span
          style={{
            padding: "0.625rem 1.25rem",
            background: primary,
            color: "#fff",
            borderRadius: 6,
            fontSize: "0.8125rem",
            fontWeight: 500,
          }}
        >
          Subscribe
        </span>
      </div>
    </div>
  )
}

function GenericBlock({
  displayName,
  props,
  brand,
}: {
  displayName: string
  props: Record<string, unknown>
  brand: Brand
}) {
  const primary = brand.colors?.primary ?? "#1a1a2e"
  const textKeys = Object.keys(props).filter(
    (k) => typeof props[k] === "string" && (props[k] as string).length > 0 && !k.includes("image")
  )
  const imageKey = Object.keys(props).find((k) => k.includes("image") && props[k])

  return (
    <div style={{ padding: "2rem 1.5rem", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: primary, textTransform: "uppercase", marginBottom: "0.5rem" }}>
        {displayName}
      </div>
      {imageKey && (
        <div
          style={{
            height: 120,
            borderRadius: 8,
            marginBottom: "1rem",
            background: `url(${props[imageKey]}) center/cover`,
            backgroundColor: "#f3f4f6",
          }}
        />
      )}
      {textKeys.length > 0 ? (
        textKeys.slice(0, 4).map((k) => (
          <p key={k} style={{ fontSize: "0.875rem", color: "#4b5563", marginBottom: "0.375rem" }}>
            {String(props[k])}
          </p>
        ))
      ) : (
        <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
          Configure content in the properties panel →
        </p>
      )}
    </div>
  )
}

function LayoutChrome({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sp-layout-chrome" data-label={label}>
      {children}
    </div>
  )
}

export function resolveLayoutChrome(
  layout: string,
  sectionProps: Record<string, unknown>
): { showNav: boolean; showFooter: boolean } {
  const layoutSlug = layout.replace(/^@pradip1995\/layout-/, "").replace(/^layout-/, "")
  const layoutPkg = layout.includes("@") ? layout : `@pradip1995/layout-${layoutSlug}`
  const props = (sectionProps[layoutPkg] as Record<string, unknown>) ?? {}

  if (layoutSlug === "minimal") {
    return {
      showNav: props.showNav === true,
      showFooter: props.showFooter === true,
    }
  }

  return {
    showNav: props.showNav !== false,
    showFooter: props.showFooter !== false,
  }
}

function findLayoutShellProps(
  sectionProps: Record<string, unknown>,
  shell: "segment-nav" | "segment-footer"
): Record<string, unknown> {
  const key = Object.keys(sectionProps).find((k) => k.endsWith(`/${shell}`) || k.endsWith(shell))
  return (key ? sectionProps[key] : {}) as Record<string, unknown>
}

export function SectionPreviewBlock({
  packageName,
  displayName,
  props,
  brand,
  selected,
  onSelect,
}: {
  packageName: string
  displayName: string
  props: Record<string, unknown>
  brand: Brand
  selected: boolean
  onSelect: () => void
}) {
  const kind = segmentKind(packageName)
  const variant = propStr(props, "variant", "overlay")

  return (
    <div
      className={`sp-section${selected ? " selected" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect()
      }}
    >
      <span className="sp-section-badge">{displayName}</span>
      {kind === "hero" && <HeroBlock props={props} brand={brand} variant={variant} />}
      {kind === "promo" && <PromoBlock props={props} brand={brand} />}
      {kind === "products" && <ProductsBlock props={props} brand={brand} />}
      {kind === "categories" && <CategoriesBlock props={props} />}
      {kind === "newsletter" && <NewsletterBlock props={props} brand={brand} />}
      {kind === "generic" && <GenericBlock displayName={displayName} props={props} brand={brand} />}
      {(kind === "cart" || kind === "checkout" || kind === "testimonials") && (
        <GenericBlock displayName={displayName} props={props} brand={brand} />
      )}
    </div>
  )
}

export function PagePreview({
  segments,
  layout,
  sections,
  sectionProps,
  brand,
  selectedSegment,
  onSelectSegment,
}: {
  segments: string[]
  layout: string
  sections: Array<{ packageName: string; displayName: string }>
  sectionProps: Record<string, unknown>
  brand: Brand
  selectedSegment: string | null
  onSelectSegment: (pkg: string) => void
}) {
  const pageSegments = stripLayoutShells(segments)
  const chrome = resolveLayoutChrome(layout, sectionProps)
  const navProps = findLayoutShellProps(sectionProps, "segment-nav")
  const footerProps = findLayoutShellProps(sectionProps, "segment-footer")

  return (
    <>
      {chrome.showNav && (
        <LayoutChrome label="Layout · Navigation">
          <NavBlock brand={brand} />
        </LayoutChrome>
      )}

      {pageSegments.length === 0 ? (
        <div className="builder-preview-empty">
          <h3>Start building your page</h3>
          <p>Add sections from the left panel. Navigation and footer come from your page layout automatically.</p>
        </div>
      ) : (
        pageSegments.map((seg) => {
          const meta = sections.find((s) => s.packageName === seg)
          const props = (sectionProps[seg] as Record<string, unknown>) ?? {}
          return (
            <SectionPreviewBlock
              key={seg}
              packageName={seg}
              displayName={meta?.displayName ?? seg.replace("@pradip1995/segment-", "")}
              props={props}
              brand={brand}
              selected={selectedSegment === seg}
              onSelect={() => onSelectSegment(seg)}
            />
          )
        })
      )}

      {chrome.showFooter && (
        <LayoutChrome label="Layout · Footer">
          <FooterBlock brand={brand} props={footerProps} />
        </LayoutChrome>
      )}
    </>
  )
}
