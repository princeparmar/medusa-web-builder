import { redirect } from "next/navigation"

/** Legacy preview tab — builder now embeds the local storefront directly. */
export default async function BuilderPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ route?: string }>
}) {
  const { id } = await params
  const { route } = await searchParams
  const q = route ? `?route=${encodeURIComponent(route)}` : ""
  redirect(`/projects/${id}/builder${q}`)
}
