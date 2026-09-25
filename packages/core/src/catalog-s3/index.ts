import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { randomUUID } from "crypto"

export type CatalogS3Config = {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  publicUrl: string
}

export function getCatalogS3Config(): CatalogS3Config | null {
  const bucket = process.env.CATALOG_S3_BUCKET?.trim()
  const region = process.env.CATALOG_S3_REGION?.trim()
  const accessKeyId = process.env.CATALOG_S3_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.CATALOG_S3_SECRET_ACCESS_KEY?.trim()
  const publicUrl = process.env.CATALOG_S3_PUBLIC_URL?.trim()

  if (!bucket || !region || !accessKeyId || !secretAccessKey || !publicUrl) {
    return null
  }

  return { bucket, region, accessKeyId, secretAccessKey, publicUrl }
}

function createClient(config: CatalogS3Config) {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "file"
}

export function buildCatalogObjectKey(params: {
  kind: "section" | "plugin"
  registryId: string
  filename: string
}): string {
  const safe = sanitizeFilename(params.filename)
  return `catalog/${params.kind}/${params.registryId}/${randomUUID()}-${safe}`
}

export function publicUrlForKey(publicUrl: string, key: string): string {
  return `${publicUrl.replace(/\/$/, "")}/${key}`
}

export async function uploadCatalogObject(params: {
  key: string
  body: Buffer
  contentType: string
}): Promise<{ key: string; url: string }> {
  const config = getCatalogS3Config()
  if (!config) {
    throw new Error(
      "Catalog S3 is not configured. Set CATALOG_S3_BUCKET, CATALOG_S3_REGION, CATALOG_S3_ACCESS_KEY_ID, CATALOG_S3_SECRET_ACCESS_KEY, and CATALOG_S3_PUBLIC_URL."
    )
  }

  const client = createClient(config)
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  )

  return {
    key: params.key,
    url: publicUrlForKey(config.publicUrl, params.key),
  }
}

export async function deleteCatalogObject(key: string): Promise<void> {
  const config = getCatalogS3Config()
  if (!config) {
    throw new Error("Catalog S3 is not configured")
  }

  const client = createClient(config)
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  )
}
