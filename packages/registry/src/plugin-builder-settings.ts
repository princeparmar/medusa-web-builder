import type { BuilderSettings } from "./schemas/index"

export { mergePluginSettings, EMPTY_BUILDER_SETTINGS } from "./settings-merge"

function settings(
  fields: BuilderSettings["fields"],
  groups?: BuilderSettings["groups"],
  defaults?: BuilderSettings["defaults"]
): BuilderSettings {
  return {
    version: "1",
    fields,
    groups: groups ?? [{ id: "config", label: "Plugin configuration" }],
    defaults,
  }
}

/** Bundled fallback when medusa-plugins package has no builder.settings.json */
export const PLUGIN_BUILDER_SETTINGS: Record<string, BuilderSettings> = {
  "stock-monitoring": settings([
    {
      id: "low_stock_threshold",
      type: "number",
      label: "Low stock threshold",
      description: "Alert when inventory falls below this quantity.",
      default: 10,
      required: false,
    },
    {
      id: "slow_moving_days_threshold",
      type: "number",
      label: "Slow-moving days",
      description: "Flag products with no sales in this many days.",
      default: 90,
      required: false,
    },
  ]),
  "medusa-invoice-sbl": settings([
    {
      id: "attachInvoiceToEmail",
      type: "boolean",
      label: "Attach invoice to order email",
      default: true,
      required: false,
    },
    {
      id: "guestJwtSecret",
      type: "short-text",
      label: "Guest JWT secret",
      description: "Used for guest invoice links — typically JWT_SECRET from .env.",
      envName: "JWT_SECRET",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
      required: false,
    },
  ]),
  "medusa-review-rating": settings([
    {
      id: "autoApprove",
      type: "boolean",
      label: "Auto-approve reviews",
      default: true,
      required: false,
    },
    {
      id: "requireVerifiedPurchase",
      type: "boolean",
      label: "Require verified purchase",
      default: false,
      required: false,
    },
    {
      id: "multiple_rating",
      type: "boolean",
      label: "Allow multiple ratings per customer",
      default: true,
      required: false,
    },
  ]),
  "medusa-contact-us": settings([
    {
      id: "default_status",
      type: "select",
      label: "Default submission status",
      options: ["pending", "in_progress", "resolved", "closed"],
      default: "pending",
      required: false,
    },
  ]),
  "order-management": settings([
    {
      id: "jwtSecret",
      type: "short-text",
      label: "JWT secret",
      envName: "JWT_SECRET",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
      required: false,
    },
    {
      id: "storefrontUrl",
      type: "short-text",
      label: "Storefront URL",
      description: "Base storefront URL for order links in emails.",
      default: "http://localhost:8000",
      required: false,
    },
  ]),
  "customer-registration": settings(
    [
      {
        id: "storefrontUrl",
        type: "short-text",
        label: "Storefront URL",
        default: "http://localhost:8000",
        required: false,
      },
      {
        id: "registration.identifier",
        type: "select",
        label: "Registration identifier",
        options: ["email", "phone", "both"],
        default: "both",
        required: false,
      },
      {
        id: "registration.require_verification",
        type: "boolean",
        label: "Require email/phone verification",
        default: true,
        required: false,
      },
      {
        id: "login.identifier",
        type: "select",
        label: "Login identifier",
        options: ["email", "phone", "both"],
        default: "both",
        required: false,
      },
    ],
    [{ id: "config", label: "Registration & login" }]
  ),
  "medusa-shiprocket-fulfillment-sbl": settings(
    [
      {
        id: "shiprocket.email",
        type: "short-text",
        label: "Shiprocket email",
        envName: "SHIPROCKET_EMAIL",
        storage: "github-secret",
        allowedStorage: ["github-secret"],
        sensitive: true,
        required: true,
      },
      {
        id: "shiprocket.password",
        type: "short-text",
        label: "Shiprocket password",
        envName: "SHIPROCKET_PASSWORD",
        storage: "github-secret",
        allowedStorage: ["github-secret"],
        sensitive: true,
        required: true,
      },
      {
        id: "shiprocket.pickupLocation",
        type: "short-text",
        label: "Pickup location",
        description: "Shiprocket warehouse / pickup location name.",
        envName: "SHIPROCKET_PICKUP_LOCATION",
        storage: "github-variable",
        allowedStorage: ["hardcoded", "github-variable"],
        default: "Primary",
        required: false,
      },
      {
        id: "webhookSecret",
        type: "short-text",
        label: "Webhook secret",
        envName: "SHIPROCKET_WEBHOOK_SECRET",
        storage: "github-secret",
        allowedStorage: ["github-secret"],
        sensitive: true,
        required: false,
      },
    ],
    [{ id: "shiprocket", label: "Shiprocket credentials" }]
  ),
}

export function pluginBuilderSettingsForPackage(packageName: string): BuilderSettings {
  return PLUGIN_BUILDER_SETTINGS[packageName] ?? { version: "1", fields: [] }
}

/** provider.settings.json entries bundled per plugin package (when not in repo) */
export const PLUGIN_PROVIDER_SETTINGS: Record<
  string,
  Array<{
    module: string
    providerId: string
    displayName: string
    description?: string
    requiresPlugin?: string
    settings: BuilderSettings
  }>
> = {}

export function providerSettingsForPackage(packageName: string) {
  return PLUGIN_PROVIDER_SETTINGS[packageName] ?? []
}
