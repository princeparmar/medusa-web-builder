"use client"

import { useEffect, useRef, useState } from "react"
import { brandPreviewStyle } from "@/lib/brand-config"
import { PagePreview } from "@/components/builder/SectionPreview"

type PageEntry = {
  route: string
  layout: string
  segments: string[]
}

type LivePreviewPanelProps = {
  projectId: string
  route: string
  pages: PageEntry[]
  segments: string[]
  layout: string
  sections: Array<{ packageName: string; displayName: string }>
  sectionProps: Record<string, unknown>
  brand: Record<string, unknown>
  selectedSegment: string | null
  onSelectSegment: (pkg: string) => void
}

export function LivePreviewPanel({
  projectId,
  route,
  pages,
  segments,
  layout,
  sections,
  sectionProps,
  brand,
  selectedSegment,
  onSelectSegment,
}: LivePreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [liveReady, setLiveReady] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route, pages, sectionProps, brand }),
        })
        const data = await res.json()
        if (!res.ok) {
          setLiveReady(false)
          setLiveError(data.error ?? "Preview unavailable")
          return
        }
        if (iframeRef.current && data.html) {
          iframeRef.current.srcdoc = data.html
          setLiveReady(true)
          setLiveError(null)
        }
      } catch {
        setLiveReady(false)
        setLiveError("Preview failed to load")
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [projectId, route, pages, sectionProps, brand])

  if (!liveReady && liveError) {
    return (
      <PagePreview
        segments={segments}
        layout={layout}
        sections={sections}
        sectionProps={sectionProps}
        brand={brand as Parameters<typeof PagePreview>[0]["brand"]}
        selectedSegment={selectedSegment}
        onSelectSegment={onSelectSegment}
      />
    )
  }

  return (
    <div className="builder-live-preview" style={brandPreviewStyle(brand)}>
      {!liveReady && (
        <div className="builder-preview-loading">Loading live preview…</div>
      )}
      <iframe
        ref={iframeRef}
        title="Live segment preview"
        className="builder-live-preview-iframe"
        sandbox="allow-same-origin"
      />
    </div>
  )
}
