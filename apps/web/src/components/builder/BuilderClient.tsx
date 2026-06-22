"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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

type PageEntry = {
  route: string
  workflow: string
  layout: string
  segments: string[]
  metadata?: { title?: string }
}

type Section = RegistrySection

function SortableSegment({
  id,
  label,
  selected,
  onSelect,
}: {
  id: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        background: selected ? "var(--border)" : "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        marginBottom: "0.5rem",
        cursor: "grab",
      }}
      onClick={onSelect}
    >
      <span {...attributes} {...listeners} style={{ color: "var(--muted)" }}>
        ⠿
      </span>
      <span style={{ fontSize: "0.875rem", flex: 1 }}>{label}</span>
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
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const loadData = useCallback(async () => {
    const [pagesRes, registryRes, draftsRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/pages`),
      fetch(`/api/projects/${projectId}/registry?pageType=${encodeURIComponent(activeRoute)}`),
      fetch(`/api/projects/${projectId}/drafts`),
    ])

    if (pagesRes.ok) {
      const data = await pagesRes.json()
      setPages(data.pages ?? [])
      setBrand(data.brand ?? {})
      setSectionProps(data.sectionProps ?? {})
    }
    if (registryRes.ok) {
      const data = await registryRes.json()
      setSections(data.sections ?? [])
    }
    if (draftsRes.ok) {
      const drafts = await draftsRes.json()
      const active = drafts.find((d: { isActive: boolean }) => d.isActive)
      setActiveDraftId(active?.id ?? drafts[0]?.id ?? null)
    }
  }, [projectId, activeRoute])

  useEffect(() => {
    loadData()
  }, [loadData])

  const currentPage = pages.find((p) => p.route === activeRoute)
  const segments = currentPage?.segments ?? []

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
    if (!currentPage) return
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
        p.route === activeRoute ? { ...p, segments: [...p.segments, packageName] } : p
      )
    )
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

  async function saveDraft() {
    setSaving(true)
    setMessage("")
    await fetch(`/api/projects/${projectId}/pages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages, brand, sectionProps }),
    })

    if (activeDraftId) {
      await fetch(`/api/projects/${projectId}/drafts/${activeDraftId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "chore: save draft from builder" }),
      })
    }
    setSaving(false)
    setMessage("Draft saved")
  }

  async function publish() {
    if (!activeDraftId) return
    setPublishing(true)
    await saveDraft()
    const res = await fetch(`/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: activeDraftId,
        mergeToMain: true,
        releaseNotes: "Published from Medusa Web Builder",
      }),
    })
    setPublishing(false)
    if (res.ok) setMessage("Publish queued — check Deployments")
    else setMessage("Publish failed")
  }

  const selectedSection = sections.find((s) => s.packageName === selectedSegment)

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 280px 300px", gap: "1rem", minHeight: "calc(100vh - 120px)" }}>
      <aside>
        <h3 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem" }}>Pages</h3>
        {pages.map((p) => (
          <button
            key={p.route}
            type="button"
            className="btn btn-secondary"
            style={{
              width: "100%",
              marginBottom: "0.375rem",
              justifyContent: "flex-start",
              background: activeRoute === p.route ? "var(--border)" : undefined,
            }}
            onClick={() => {
              setActiveRoute(p.route)
              setSelectedSegment(null)
            }}
          >
            {p.metadata?.title ?? p.route}
          </button>
        ))}

        <h3 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", margin: "1.5rem 0 0.75rem" }}>Components</h3>
        <ComponentPalette
          projectId={projectId}
          activeRoute={activeRoute}
          onAdd={addSegment}
          usedPackages={segments}
        />
      </aside>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1rem" }}>{currentPage?.metadata?.title ?? activeRoute}</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={saveDraft} disabled={saving}>
              {saving ? "Saving..." : "Save draft"}
            </button>
            <button type="button" className="btn btn-primary" onClick={publish} disabled={publishing}>
              {publishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
        {message && <div className="alert alert-success">{message}</div>}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={segments} strategy={verticalListSortingStrategy}>
            {segments.map((seg) => {
              const meta = sections.find((s) => s.packageName === seg)
              return (
                <div key={seg} style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
                  <div style={{ flex: 1 }}>
                    <SortableSegment
                      id={seg}
                      label={meta?.displayName ?? seg.replace("@pradip1995/segment-", "")}
                      selected={selectedSegment === seg}
                      onSelect={() => setSelectedSegment(seg)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "0.5rem" }}
                    onClick={() => removeSegment(seg)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </SortableContext>
        </DndContext>

        {segments.length === 0 && (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
            Add sections from the left panel
          </p>
        )}
      </section>

      <aside className="card" style={{ overflow: "auto" }}>
        <h3 style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>Section properties</h3>
        {selectedSegment && selectedSection ? (
          <>
            <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
              {selectedSection.description}
              <br />
              <span style={{ fontSize: "0.65rem" }}>
                {selectedSection.packageName} · v{selectedSection.installedVersion ?? selectedSection.version}
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
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Select a section to edit properties</p>
        )}
      </aside>

      <aside className="card" style={{ overflow: "auto" }}>
        <BrandPanel brand={brand} onChange={setBrand} projectId={projectId} />
      </aside>
    </div>
  )
}
