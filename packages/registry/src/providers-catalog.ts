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

/** Built-in Medusa core module providers (not shipped as medusa-plugins packages) */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  provider("auth", "google", "Google OAuth", "Google sign-in for customers", [
    {
      id: "clientId",
      type: "short-text",
      label: "Client ID",
      description: "OAuth 2.0 client ID from Google Cloud Console.",
      required: true,
      envName: "GOOGLE_CLIENT_ID",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
    },
    {
      id: "clientSecret",
      type: "short-text",
      label: "Client secret",
      description: "OAuth client secret — never commit this value.",
      required: true,
      envName: "GOOGLE_CLIENT_SECRET",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
    },
  ]),
  provider("payment", "cashfree", "Cashfree", "Cashfree payment gateway", [
    {
      id: "client_id",
      type: "short-text",
      label: "Client ID",
      description: "Cashfree API client ID from the merchant dashboard.",
      required: true,
      envName: "CASHFREE_CLIENT_ID",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
    },
    {
      id: "client_secret",
      type: "short-text",
      label: "Client secret",
      required: true,
      envName: "CASHFREE_CLIENT_SECRET",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
    },
    {
      id: "environment",
      type: "select",
      label: "Environment",
      description: "Use sandbox while testing; switch to production for live payments.",
      options: ["sandbox", "production"],
      default: "sandbox",
      storage: "github-variable",
      allowedStorage: ["hardcoded", "github-variable"],
      envName: "CASHFREE_ENVIRONMENT",
    },
  ]),
  provider("notification", "smtp", "SMTP", "Email notifications via SMTP", [
    {
      id: "host",
      type: "short-text",
      label: "SMTP host",
      description: "Hostname of your SMTP server (e.g. smtp.gmail.com).",
      required: true,
      envName: "SMTP_HOST",
      storage: "github-variable",
      allowedStorage: ["hardcoded", "github-variable"],
    },
    {
      id: "port",
      type: "number",
      label: "SMTP port",
      required: true,
      envName: "SMTP_PORT",
      storage: "github-variable",
      allowedStorage: ["hardcoded", "github-variable"],
      default: 465,
    },
    {
      id: "user",
      type: "short-text",
      label: "SMTP user",
      required: true,
      envName: "SMTP_USER",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
    },
    {
      id: "pass",
      type: "short-text",
      label: "SMTP password",
      required: true,
      envName: "SMTP_PASS",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
    },
    {
      id: "from",
      type: "short-text",
      label: "From address",
      description: "Sender email shown to customers.",
      required: true,
      envName: "SMTP_FROM",
      storage: "github-variable",
      allowedStorage: ["hardcoded", "github-variable"],
    },
  ]),
  provider("file", "s3", "AWS S3", "S3 file storage", [
    {
      id: "access_key_id",
      type: "short-text",
      label: "Access key ID",
      required: true,
      envName: "AWS_ACCESS_KEY",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
    },
    {
      id: "secret_access_key",
      type: "short-text",
      label: "Secret access key",
      required: true,
      envName: "AWS_SECRET_ACCESS_KEY",
      storage: "github-secret",
      allowedStorage: ["github-secret"],
      sensitive: true,
    },
    {
      id: "region",
      type: "short-text",
      label: "Region",
      required: true,
      envName: "AWS_REGION",
      storage: "github-variable",
      allowedStorage: ["hardcoded", "github-variable"],
    },
    {
      id: "bucket",
      type: "short-text",
      label: "Bucket",
      required: true,
      envName: "AWS_BUCKET",
      storage: "github-variable",
      allowedStorage: ["hardcoded", "github-variable"],
    },
    {
      id: "file_url",
      type: "short-text",
      label: "Public file URL",
      description: "CDN or S3 public URL prefix for uploaded files.",
      required: true,
      envName: "AWS_FILE_URL",
      storage: "github-variable",
      allowedStorage: ["hardcoded", "github-variable"],
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
