import { pilotSettingsForPackage } from "./pilot-settings"

export type ComponentType = "segment" | "layout"
export type SectionCategory =
  | "home"
  | "store"
  | "product"
  | "cart"
  | "checkout"
  | "account"
  | "orders"
  | "global"
  | "layout"
  | "custom"

export type SectionCatalogEntry = {
  packageName: string
  displayName: string
  componentType: ComponentType
  category: SectionCategory
  pageTypes: string[]
  description: string
  version: string
  latestVersion?: string
  githubRepo?: string
  settings?: unknown
  manifest?: Record<string, unknown>
}

export const DEFAULT_STOREFRONT_COMPONENTS_REPO =
  "https://github.com/pradip1995/storefront-components"

export const ROUTE_CATEGORY: Record<string, SectionCategory> = {
  "/": "home",
  "/store": "store",
  "/products/[handle]": "product",
  "/cart": "cart",
  "/checkout": "checkout",
  "/account": "account",
  "/wishlist": "account",
  "/help": "account",
  "/orders/[id]": "orders",
}

export const CATEGORY_LABELS: Record<SectionCategory, string> = {
  home: "Home page sections",
  store: "Store & listing",
  product: "Product detail",
  cart: "Cart",
  checkout: "Checkout",
  account: "Account & auth",
  orders: "Orders",
  global: "Global (all pages)",
  layout: "Layout shells",
  custom: "Custom repo",
}

function kebabToCamel(value: string): string {
  return value.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function seg(
  slug: string,
  displayName: string,
  category: SectionCategory,
  pageTypes: string[],
  description: string,
  version = "0.1.0",
  latestVersion?: string
): SectionCatalogEntry {
  const id = slug.replace(/^segment-/, "")
  const packageName = `@pradip1995/${slug}`
  return {
    packageName,
    displayName,
    componentType: "segment",
    category,
    pageTypes,
    description,
    version,
    latestVersion: latestVersion ?? version,
    githubRepo: DEFAULT_STOREFRONT_COMPONENTS_REPO,
    manifest: { id, type: "segment", version, dataKey: kebabToCamel(id) },
    settings:
      pilotSettingsForPackage(packageName) ?? {
        version: "1",
        fields: [{ id: "title", type: "short-text", label: "Section title", group: "content" }],
        groups: [{ id: "content", label: "Content" }],
      },
  }
}

function layout(
  slug: string,
  displayName: string,
  description: string,
  pageTypes: string[] = [],
  version = "0.1.0"
): SectionCatalogEntry {
  const id = slug.replace(/^layout-/, "")
  const packageName = `@pradip1995/${slug}`
  return {
    packageName,
    displayName,
    componentType: "layout",
    category: "layout",
    pageTypes,
    description,
    version,
    latestVersion: version,
    githubRepo: DEFAULT_STOREFRONT_COMPONENTS_REPO,
    manifest: { id, type: "layout", version },
    settings:
      pilotSettingsForPackage(packageName) ?? {
        version: "1",
        fields: [
          { id: "showNav", type: "boolean", label: "Show navigation", default: true, group: "layout" },
          { id: "showFooter", type: "boolean", label: "Show footer", default: true, group: "layout" },
        ],
        groups: [{ id: "layout", label: "Layout" }],
      },
  }
}

/** Full catalog mirrored from storefront-components + page mapping */
export const SECTION_CATALOG: SectionCatalogEntry[] = [
  // Layout shells
  layout("layout-main", "Main layout", "Default storefront shell with nav and footer"),
  layout("layout-minimal", "Minimal layout", "Checkout / focused flows without distractions", [
    "/checkout",
  ]),
  layout("layout-account", "Account layout", "Account area layout with sidebar", ["/account", "/orders/[id]"]),

  // Global
  {
    ...seg("segment-nav", "Navigation", "global", [
      "/",
      "/store",
      "/products/[handle]",
      "/cart",
      "/checkout",
      "/account",
      "/wishlist",
      "/help",
      "/orders/[id]",
    ], "Top navigation bar with logo and menu"),
    settings: {
      version: "1",
      fields: [
        { id: "logoUrl", type: "image", label: "Logo", group: "brand" },
        { id: "logoUrlLight", type: "image", label: "Logo (light)", group: "brand" },
      ],
      groups: [{ id: "brand", label: "Brand" }],
      inherits: ["brand.logoUrl"],
    },
  },
  {
    ...seg("segment-footer", "Footer", "global", [
      "/",
      "/store",
      "/products/[handle]",
      "/cart",
      "/checkout",
      "/account",
      "/wishlist",
      "/help",
      "/orders/[id]",
    ], "Site footer with links and copyright"),
    settings: {
      version: "1",
      fields: [{ id: "copyright", type: "short-text", label: "Copyright text", group: "content" }],
      inherits: ["brand.companyName"],
    },
  },

  // Home
  {
    ...seg("segment-hero", "Hero", "home", ["/"], "Homepage hero banner with CTA"),
    settings: {
      version: "1",
      fields: [
        { id: "variant", type: "select", label: "Layout", options: ["overlay", "split", "centered"], default: "overlay", group: "layout" },
        { id: "homeBanner.title", type: "short-text", label: "Title", group: "content" },
        { id: "homeBanner.subtitle", type: "short-text", label: "Subtitle", group: "content" },
        { id: "homeBanner.image", type: "image", label: "Banner image", group: "content" },
        { id: "homeBanner.buttonName", type: "short-text", label: "Button text", group: "content" },
        { id: "homeBanner.buttonLink", type: "short-text", label: "Button link", group: "content" },
      ],
      groups: [
        { id: "layout", label: "Layout" },
        { id: "content", label: "Content" },
      ],
      inherits: ["brand.colors", "brand.logoUrl"],
    },
  },
  seg("segment-shop-by-category", "Shop by Category", "home", ["/"], "Category tiles on the homepage"),
  seg("segment-new-arrivals", "New Arrivals", "home", ["/"], "Latest products carousel"),
  seg("segment-promotional-banners", "Promotional Banners", "home", ["/"], "Marketing banner grid"),
  seg("segment-collections-showcase", "Collections Showcase", "home", ["/"], "Featured collections"),
  seg("segment-why-choose-us", "Why Choose Us", "home", ["/"], "Value proposition highlights"),
  seg("segment-bestsellers-carousel", "Bestsellers Carousel", "home", ["/"], "Top-selling products slider"),
  seg("segment-reviews-marquee", "Reviews Marquee", "home", ["/"], "Scrolling customer reviews"),
  seg("segment-features", "Features", "home", ["/"], "Feature icons / USP row"),

  // Store listing
  seg("segment-mobile-filters", "Mobile Filters", "store", ["/store"], "Filter drawer for mobile PLP"),
  seg("segment-refinement-list", "Refinement List", "store", ["/store"], "Sidebar filters and sort"),
  seg("segment-product-grid", "Product Grid", "store", ["/store"], "Product listing grid"),

  // Product detail (PDP)
  seg("segment-product-gallery", "Product Gallery", "product", ["/products/[handle]"], "Image gallery on PDP"),
  seg("segment-product-info", "Product Info", "product", ["/products/[handle]"], "Title, price, description"),
  seg("segment-product-actions", "Product Actions", "product", ["/products/[handle]"], "Add to cart, variants, qty"),
  seg("segment-related-products", "Related Products", "product", ["/products/[handle]"], "Cross-sell carousel"),

  // Cart
  seg("segment-cart-item", "Cart Item", "cart", ["/cart"], "Line item row"),
  seg("segment-cart-summary", "Cart Summary", "cart", ["/cart"], "Totals and checkout CTA"),

  // Checkout
  seg("segment-checkout-form", "Checkout Form", "checkout", ["/checkout"], "Shipping & payment form"),
  seg("segment-checkout-summary", "Checkout Summary", "checkout", ["/checkout"], "Order summary sidebar"),

  // Account
  seg("segment-login-template", "Login Template", "account", ["/account"], "Email/password login form"),
  seg("segment-google-login", "Google Login", "account", ["/account"], "Google OAuth sign-in button"),
  seg("segment-wishlist", "Wishlist", "account", ["/wishlist"], "Saved products list"),
  seg("segment-help", "Help", "account", ["/help"], "Help / FAQ content"),

  // Orders
  seg("segment-order-details", "Order Details", "orders", ["/orders/[id]"], "Single order view"),
]

export const PAGE_ROUTE_LABELS: Record<string, string> = {
  "/": "Home",
  "/store": "Store",
  "/products/[handle]": "Product detail",
  "/cart": "Cart",
  "/checkout": "Checkout",
  "/account": "Account",
  "/wishlist": "Wishlist",
  "/help": "Help",
  "/orders/[id]": "Order detail",
}

export function packageToDisplayName(packageName: string): string {
  return packageName
    .replace(/^@[^/]+\/(segment|layout)-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
