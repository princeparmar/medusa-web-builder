"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { PropertyForm, initialValuesFromSchema } from "@/components/builder/PropertyForm"
import { BrandPanel } from "@/components/builder/BrandPanel"
import { ComponentPalette, type RegistrySection } from "@/components/builder/ComponentPalette"
import { StorefrontLivePreview } from "@/components/builder/StorefrontLivePreview"
import { isLayoutShellPackage, stripLayoutShells } from "@mwb/registry/layout-shell"
import { BrandFontStyles } from "@/components/BrandFontStyles"
import { persistBuilderState } from "@/lib/persist-project-config"
import "@/components/builder/builder.css"

type PageEntry = {
  route: string
  workflow: string
  layout: string
  segments: string[]
  metadata?: { title?: string }
}

type Section = RegistrySection

function SortableStructureItem({
  id,
  label,
  selected,
  onSelect,
  onRemove,
}: {
  id: string
  label: string
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`builder-structure-item${selected ? " selected" : ""}${isDragging ? " dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
    >
      <span className="builder-drag-handle" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        ⠿
      </span>
      <span className="builder-structure-label">{label}</span>
      <button
        type="button"
        className="builder-structure-remove"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </div>
  )
}

export default function BuilderClient({ projectId }: { projectId: string }) {
  const [pages, setPages] = useState<PageEntry[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [brand, setBrand] = useState<Record<string, unknown>>({})
  const [sectionProps, setSectionProps] = useState<Record<string, unknown>>({})
  const [activeRoute, setActiveRoute] = useState("/")
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [previewSaveToken, setPreviewSaveToken] = useState(0)
  const [rightTab, setRightTab] = useState<"section" | "brand">("section")
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop")
  const dataLoadedRef = useRef(false)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipAutoSaveRef = useRef(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const loadData = useCallback(async () => {
    const [pagesRes, registryRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/pages`),
      fetch(`/api/projects/${projectId}/registry?pageType=${encodeURIComponent(activeRoute)}`),
    ])

    if (pagesRes.ok) {
      const data = await pagesRes.json()
      const loadedPages = (data.pages ?? []) as PageEntry[]
      setPages(
        loadedPages.map((p) => ({
          ...p,
          segments: stripLayoutShells(p.segments ?? []),
        }))
      )
      setBrand(data.brand ?? {})
      const loadedProps = (data.sectionProps ?? {}) as Record<string, unknown>
      setSectionProps(loadedProps)
    }
    if (registryRes.ok) {
      const data = await registryRes.json()
      setSections(data.sections ?? [])
    }
    dataLoadedRef.current = true
  }, [projectId, activeRoute])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!sections.length || !pages.length) return
    const layoutPackages = [
      "@pradip1995/segment-nav",
      "@pradip1995/segment-footer",
      "@pradip1995/segment-promo-bar",
    ]
    const packages = new Set<string>(layoutPackages)
    for (const page of pages) {
      for (const seg of page.segments ?? []) {
        if (!isLayoutShellPackage(seg)) packages.add(seg)
      }
    }
    setSectionProps((prev) => {
      let changed = false
      const next = { ...prev }
      for (const pkg of packages) {
        if (prev[pkg] !== undefined) continue
        const meta = sections.find((s) => s.packageName === pkg)
        const schema = meta?.settingsSchemaJson as Parameters<typeof initialValuesFromSchema>[0]
        if (!schema) continue
        next[pkg] = initialValuesFromSchema(schema)
        changed = true
      }
      return changed ? next : prev
    })
  }, [sections, pages])

  const currentPage = pages.find((p) => p.route === activeRoute)
  const segments = stripLayoutShells(currentPage?.segments ?? [])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !currentPage) return

    const oldIndex = segments.indexOf(active.id as string)
    const newIndex = segments.indexOf(over.id as string)
    const newSegments = arrayMove(segments, oldIndex, newIndex)

    setPages((prev) =>
      prev.map((p) => (p.route === activeRoute ? { ...p, segments: newSegments } : p))
    )
  }

  function addSegment(packageName: string) {
    if (!currentPage || isLayoutShellPackage(packageName)) return
    if (segments.includes(packageName)) return
    const meta = sections.find((s) => s.packageName === packageName)
    const schema = meta?.settingsSchemaJson as Parameters<typeof initialValuesFromSchema>[0]
    if (!sectionProps[packageName] && schema) {
      setSectionProps((prev) => ({
        ...prev,
        [packageName]: initialValuesFromSchema(schema),
      }))
    }
    setPages((prev) =>
      prev.map((p) =>
        p.route === activeRoute ? { ...p, segments: [...stripLayoutShells(p.segments), packageName] } : p
      )
    )
    setSelectedSegment(packageName)
    setRightTab("section")
  }

  function removeSegment(packageName: string) {
    setPages((prev) =>
      prev.map((p) =>
        p.route === activeRoute
          ? { ...p, segments: p.segments.filter((s) => s !== packageName) }
          : p
      )
    )
    if (selectedSegment === packageName) setSelectedSegment(null)
  }

  function selectSegment(packageName: string) {
    if (isLayoutShellPackage(packageName)) return
    setSelectedSegment(packageName)
    setRightTab("section")
  }

  const flushSave = useCallback(
    async (rebuildStorefront = true) => {
      setSaving(true)
      setMessage("")
      const result = await persistBuilderState(
        projectId,
        { pages, brand, sectionProps },
        { rebuildStorefront }
      )
      setSaving(false)
      if (result.ok) {
        setPreviewSaveToken((t) => t + 1)
        setMessage("Saved to pages.config.json")
      } else {
        setMessage(result.error ?? "Save failed")
      }
      setTimeout(() => setMessage(""), 3000)
    },
    [projectId, pages, brand, sectionProps]
  )

  useEffect(() => {
    if (!dataLoadedRef.current) return
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false
      return
    }
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      void flushSave(true)
    }, 900)
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    }
  }, [pages, sectionProps, brand, flushSave])

  async function saveDraft() {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    await flushSave(true)
  }

  const selectedSection = sections.find((s) => s.packageName === selectedSegment)
  const pageTitle = currentPage?.metadata?.title ?? activeRoute

  return (
    <div className="builder-page">
      <BrandFontStyles brand={brand} />
      <div className="builder-toolbar">
        <div className="builder-toolbar-title">
          {pageTitle}
          <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: "0.5rem", fontSize: "0.8125rem" }}>
            {activeRoute}
          </span>
        </div>
        <div className="builder-toolbar-actions">
          <button type="button" className="btn btn-primary" onClick={saveDraft} disabled={saving}>
            {saving ? "Saving…" : "Save now"}
          </button>
          {saving && (
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Updating pages.config.json…</span>
          )}
        </div>
      </div>

      <div className="builder-body">
        {/* Left: pages, structure, components */}
        <aside className="builder-panel">
          <div className="builder-panel-header">Pages</div>
          <div className="builder-panel-body" style={{ paddingBottom: 0 }}>
            {pages.map((p) => (
              <button
                key={p.route}
                type="button"
                className={`builder-page-btn${activeRoute === p.route ? " active" : ""}`}
                onClick={() => {
                  setActiveRoute(p.route)
                  setSelectedSegment(null)
                }}
              >
                <span>{p.metadata?.title ?? p.route}</span>
                <span className="builder-page-route">{p.route}</span>
              </button>
            ))}
          </div>

          <div className="builder-panel-header">Page structure</div>
          <div className="builder-panel-body" style={{ maxHeight: 200, flex: "none" }}>
            {segments.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.75rem", textAlign: "center", padding: "0.5rem 0" }}>
                No sections yet
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={segments} strategy={verticalListSortingStrategy}>
                  {segments.map((seg) => {
                    const meta = sections.find((s) => s.packageName === seg)
                    return (
                      <SortableStructureItem
                        key={seg}
                        id={seg}
                        label={meta?.displayName ?? seg.replace("@pradip1995/segment-", "")}
                        selected={selectedSegment === seg}
                        onSelect={() => selectSegment(seg)}
                        onRemove={() => removeSegment(seg)}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="builder-panel-header">Add sections</div>
          <div className="builder-panel-body" style={{ flex: 1 }}>
            <ComponentPalette
              projectId={projectId}
              activeRoute={activeRoute}
              onAdd={addSegment}
              usedPackages={segments}
            />
          </div>
        </aside>

        {/* Center: live preview */}
        <main className="builder-canvas">
          <div className="builder-canvas-toolbar">
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Storefront preview</span>
            <div className="builder-viewport-toggle">
              <button
                type="button"
                className={`builder-viewport-btn${viewport === "desktop" ? " active" : ""}`}
                onClick={() => setViewport("desktop")}
              >
                Desktop
              </button>
              <button
                type="button"
                className={`builder-viewport-btn${viewport === "mobile" ? " active" : ""}`}
                onClick={() => setViewport("mobile")}
              >
                Mobile
              </button>
            </div>
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
              Pick a section in Page structure to edit
            </span>
          </div>
          <div className="builder-preview-scroll">
            <div className={`builder-preview-frame${viewport === "mobile" ? " mobile" : ""}`}>
              <StorefrontLivePreview
                projectId={projectId}
                route={activeRoute}
                previewSaveToken={previewSaveToken}
              />
            </div>
          </div>
        </main>

        {/* Right: properties / brand */}
        <aside className="builder-panel builder-panel-right">
          <div className="builder-right-tabs">
            <button
              type="button"
              className={`builder-right-tab${rightTab === "section" ? " active" : ""}`}
              onClick={() => setRightTab("section")}
            >
              Section
            </button>
            <button
              type="button"
              className={`builder-right-tab${rightTab === "brand" ? " active" : ""}`}
              onClick={() => setRightTab("brand")}
            >
              Brand
            </button>
          </div>
          <div className="builder-panel-body">
            {rightTab === "section" ? (
              selectedSegment && selectedSection ? (
                <>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    {selectedSection.displayName}
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
                    {selectedSection.description}
                    <br />
                    <span style={{ fontSize: "0.6875rem" }}>
                      {selectedSection.packageName} · v
                      {selectedSection.installedVersion ?? selectedSection.version}
                    </span>
                  </p>
                  <PropertyForm
                    schema={selectedSection.settingsSchemaJson as Parameters<typeof PropertyForm>[0]["schema"]}
                    values={(sectionProps[selectedSegment] as Record<string, unknown>) ?? {}}
                    onChange={(vals) =>
                      setSectionProps((prev) => ({ ...prev, [selectedSegment]: vals }))
                    }
                    projectId={projectId}
                    brand={brand}
                  />
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "2rem 0.5rem", color: "var(--muted)" }}>
                  <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>No section selected</p>
                  <p style={{ fontSize: "0.75rem" }}>
                    Select a section from Page structure on the left to edit its properties.
                  </p>
                </div>
              )
            ) : (
              <BrandPanel brand={brand} onChange={setBrand} projectId={projectId} />
            )}
          </div>
        </aside>
      </div>

      {message && <div className="builder-message">{message}</div>}
    </div>
  )
}
