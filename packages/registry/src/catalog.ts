import { isLayoutShellPackage, stripLayoutShells } from "./layout-shell"
import type { SectionCategory } from "./catalog-labels"
import {
  ROUTE_CATEGORY,
  CATEGORY_LABELS,
  PAGE_ROUTE_LABELS,
} from "./catalog-labels"

export { isLayoutShellPackage, stripLayoutShells }
export type { SectionCategory }
export { ROUTE_CATEGORY, CATEGORY_LABELS, PAGE_ROUTE_LABELS }

export type ComponentType = "segment" | "layout"

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
  "https://github.com/princeparmar/storefront-components"

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
  seg("segment-nav", "Navigation", "global", [
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
  seg("segment-footer", "Footer", "global", [
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

  // Home
  seg("segment-hero", "Hero", "home", ["/"], "Homepage hero banner with CTA"),
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

export function packageToDisplayName(packageName: string): string {
  return packageName
    .replace(/^@[^/]+\/(segment|layout)-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
