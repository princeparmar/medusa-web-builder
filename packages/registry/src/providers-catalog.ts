import type { BuilderSettings } from "./schemas/index"

export type ProviderCatalogEntry = {
  module: string
  providerId: string
  displayName: string
  description: string
  requiresPlugin?: string
  settings: BuilderSettings
}

function provider(
  module: string,
  providerId: string,
  displayName: string,
  description: string,
  fields: BuilderSettings["fields"],
  requiresPlugin?: string
): ProviderCatalogEntry {
  return {
    module,
    providerId,
    displayName,
    description,
    requiresPlugin,
    settings: {
      version: "1",
      fields,
      groups: [{ id: "config", label: "Provider configuration" }],
    },
  }
}

/** Medusa module providers with builder.settings-style field definitions */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  provider("auth", "google", "Google OAuth", "Google sign-in for customers", [
    {
      id: "clientId",
      type: "short-text",
      label: "Client ID",
      envName: "GOOGLE_CLIENT_ID",
      storage: "github-secret",
      sensitive: true,
    },
    {
      id: "clientSecret",
      type: "short-text",
      label: "Client secret",
      envName: "GOOGLE_CLIENT_SECRET",
      storage: "github-secret",
      sensitive: true,
    },
  ]),
  provider(
    "fulfillment",
    "shiprocket",
    "Shiprocket",
    "Shiprocket shipping integration",
    [
      {
        id: "email",
        type: "short-text",
        label: "Shiprocket email",
        envName: "SHIPROCKET_EMAIL",
        storage: "github-secret",
        sensitive: true,
      },
      {
        id: "password",
        type: "short-text",
        label: "Shiprocket password",
        envName: "SHIPROCKET_PASSWORD",
        storage: "github-secret",
        sensitive: true,
      },
      {
        id: "pickupLocation",
        type: "short-text",
        label: "Pickup location",
        envName: "SHIPROCKET_PICKUP_LOCATION",
        storage: "github-variable",
        default: "Warehouse A",
      },
    ],
    "medusa-shiprocket-fulfillment-sbl"
  ),
  provider("payment", "cashfree", "Cashfree", "Cashfree payment gateway", [
    {
      id: "client_id",
      type: "short-text",
      label: "Client ID",
      envName: "CASHFREE_CLIENT_ID",
      storage: "github-secret",
      sensitive: true,
    },
    {
      id: "client_secret",
      type: "short-text",
      label: "Client secret",
      envName: "CASHFREE_CLIENT_SECRET",
      storage: "github-secret",
      sensitive: true,
    },
    {
      id: "environment",
      type: "select",
      label: "Environment",
      options: ["sandbox", "production"],
      default: "sandbox",
      storage: "github-variable",
      envName: "CASHFREE_ENVIRONMENT",
    },
  ]),
  provider("notification", "smtp", "SMTP", "Email notifications via SMTP", [
    {
      id: "host",
      type: "short-text",
      label: "SMTP host",
      envName: "SMTP_HOST",
      storage: "github-variable",
    },
    {
      id: "port",
      type: "number",
      label: "SMTP port",
      envName: "SMTP_PORT",
      storage: "github-variable",
      default: 465,
    },
    {
      id: "user",
      type: "short-text",
      label: "SMTP user",
      envName: "SMTP_USER",
      storage: "github-secret",
      sensitive: true,
    },
    {
      id: "pass",
      type: "short-text",
      label: "SMTP password",
      envName: "SMTP_PASS",
      storage: "github-secret",
      sensitive: true,
    },
    {
      id: "from",
      type: "short-text",
      label: "From address",
      envName: "SMTP_FROM",
      storage: "github-variable",
    },
  ]),
  provider("file", "s3", "AWS S3", "S3 file storage", [
    {
      id: "access_key_id",
      type: "short-text",
      label: "Access key ID",
      envName: "AWS_ACCESS_KEY",
      storage: "github-secret",
      sensitive: true,
    },
    {
      id: "secret_access_key",
      type: "short-text",
      label: "Secret access key",
      envName: "AWS_SECRET_ACCESS_KEY",
      storage: "github-secret",
      sensitive: true,
    },
    {
      id: "region",
      type: "short-text",
      label: "Region",
      envName: "AWS_REGION",
      storage: "github-variable",
    },
    {
      id: "bucket",
      type: "short-text",
      label: "Bucket",
      envName: "AWS_BUCKET",
      storage: "github-variable",
    },
    {
      id: "file_url",
      type: "short-text",
      label: "Public file URL",
      envName: "AWS_FILE_URL",
      storage: "github-variable",
    },
  ]),
]

export function getProviderEntry(module: string, providerId: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.module === module && p.providerId === providerId)
}

export const MODULE_LABELS: Record<string, string> = {
  auth: "Authentication",
  fulfillment: "Fulfillment",
  payment: "Payment",
  notification: "Notification",
  file: "File storage",
}
