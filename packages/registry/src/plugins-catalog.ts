export type PluginCatalogEntry = {
  packageName: string
  displayName: string
  description: string
  version: string
  latestVersion?: string
  githubRepo: string
  medusaResolve: string
  category: string
  settings?: unknown
}

export const DEFAULT_MEDUSA_PLUGINS_REPO = "https://github.com/SmartByteLabs/medusa-plugins"

function plugin(
  packageName: string,
  displayName: string,
  description: string,
  version: string,
  category: string
): PluginCatalogEntry {
  return {
    packageName,
    displayName,
    description,
    version,
    latestVersion: version,
    githubRepo: DEFAULT_MEDUSA_PLUGINS_REPO,
    medusaResolve: packageName,
    category,
    settings: undefined,
  }
}

/** Catalog aligned with medusa-plugins monorepo + create-storefront-app presets */
export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  plugin("medusa-product-helper", "Product Helper", "Product utilities and helpers for Medusa admin", "0.0.71", "catalog"),
  plugin("medusa-dynamic-metadata", "Dynamic Metadata", "Custom metadata fields on products and entities", "0.0.11", "catalog"),
  plugin("medusa-review-rating", "Review & Rating", "Product reviews and star ratings", "0.0.38", "marketing"),
  plugin("medusa-contact-us", "Contact Us", "Storefront email subscriptions and contact opt-ins", "0.0.29", "marketing"),
  plugin("customer-registration", "Customer Registration", "Custom customer registration flows for the storefront", "0.0.126", "auth"),
  plugin("stock-monitoring", "Stock Monitoring", "Low-stock alerts and inventory monitoring emails", "0.0.6", "inventory"),
  plugin("medusa-invoice-sbl", "Invoice (SBL)", "Invoice generation for orders", "0.0.12", "orders"),
  plugin("order-management", "Order Management", "Order notifications, SMTP, and storefront order workflows", "0.0.79", "orders"),
  plugin("medusa-shiprocket-fulfillment-sbl", "Shiprocket Fulfillment", "Shiprocket shipping and fulfillment integration", "0.0.27", "fulfillment"),
  plugin("medusa-notification-token-management", "Notification Tokens", "Push notification device token management", "0.0.2", "notifications"),
  plugin("medusa-customer-file-upload", "Customer File Upload", "Allow customers to upload files on the storefront", "0.0.2", "content"),
  plugin("medusa-analytics", "Analytics", "Store analytics and reporting", "0.0.25", "analytics"),
  plugin("medusa-export", "Data Export", "Export catalog and order data", "0.0.7", "admin"),
  plugin("medusa-hdfc-payment", "HDFC Payment", "HDFC payment gateway for Medusa", "0.0.9", "payments"),
  plugin("medusa-notification-provider", "Notification Provider", "Custom notification delivery provider", "0.0.3", "notifications"),
  plugin("medusa-auth-facebook", "Facebook Auth", "Facebook OAuth login for customers", "0.0.4", "auth"),
  plugin("medusa-blog-management", "Blog Management", "Blog posts and content management", "0.0.12", "content"),
  plugin("medusa-live-chat", "Live Chat", "Live chat widget integration", "0.0.3", "support"),
  plugin("medusa-manual-product-suggestion", "Product Suggestions", "Manual product recommendation rules", "0.0.3", "marketing"),
  plugin("medusa-plugin-quickink-logistics", "QuickInk Logistics", "QuickInk logistics and shipping", "0.0.2", "fulfillment"),
  plugin("medusa-qikink", "Qikink", "Qikink print-on-demand integration", "0.0.6", "fulfillment"),
  plugin("medusa-referral-affiliate", "Referral & Affiliate", "Referral codes and affiliate tracking", "0.0.1", "marketing"),
  plugin("medusa-seo-suite", "SEO Suite", "SEO metadata and sitemap tools", "0.0.2", "marketing"),
  plugin("medusa-smart-search", "Smart Search", "Postgres full-text and trigram product search", "0.0.1", "search"),
  plugin("medusa-amazon", "Amazon", "Amazon marketplace integration", "0.0.2", "channels"),
  plugin("i18n-lang-json-files", "i18n Language Files", "JSON-based language file management", "0.0.1", "i18n"),
]

export const PLUGIN_CATEGORY_LABELS: Record<string, string> = {
  catalog: "Catalog & products",
  content: "Content & CMS",
  marketing: "Marketing & reviews",
  auth: "Authentication",
  inventory: "Inventory",
  orders: "Orders & invoices",
  fulfillment: "Fulfillment & shipping",
  notifications: "Notifications",
  analytics: "Analytics",
  admin: "Admin tools",
  payments: "Payments",
  support: "Support",
  search: "Search",
  channels: "Sales channels",
  i18n: "Internationalization",
  custom: "Custom plugins",
}

export function packageToPluginDisplayName(packageName: string): string {
  return packageName
    .replace(/^@[^/]+\//, "")
    .replace(/^medusa-plugin-/, "")
    .replace(/^medusa-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
