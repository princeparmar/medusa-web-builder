"use client"

import { useRef, useState } from "react"
import {
  FONT_FAMILY_PRESETS,
  GOOGLE_FONTS,
  type BrandFontConfig,
  type BrandFontSource,
  fontFormatFromFilename,
  normalizeFontConfig,
} from "@/lib/brand-config"
import { uploadProjectAsset } from "@/lib/upload-project-asset"

const FONT_FILE_ACCEPT = ".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"

const SOURCE_OPTIONS: { id: BrandFontSource; label: string }[] = [
  { id: "preset", label: "Preset" },
  { id: "google", label: "Google" },
  { id: "file", label: "File" },
]

const GOOGLE_FONT_SET = new Set<string>(GOOGLE_FONTS)

function isListedGoogleFont(family: string): boolean {
  return GOOGLE_FONT_SET.has(family)
}

export function FontSelectField({
  label,
  value,
  onChange,
  projectId,
}: {
  label: string
  value: unknown
  onChange: (config: BrandFontConfig) => void
  projectId: string
}) {
  const config = normalizeFontConfig(value)
  const listId = `font-list-${label.replace(/\s+/g, "-").toLowerCase()}`
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [customGoogle, setCustomGoogle] = useState(() => !isListedGoogleFont(config.family))

  function patch(partial: Partial<BrandFontConfig>) {
    onChange({ ...config, ...partial })
  }

  function setSource(source: BrandFontSource) {
    if (source === config.source) return
    if (source === "google") {
      onChange({
        source: "google",
        family: isListedGoogleFont(config.family) ? config.family : "Inter",
        weights: config.weights ?? "400;500;600;700",
      })
      setCustomGoogle(false)
      return
    }
    if (source === "file") {
      onChange({
        source: "file",
        family: config.family || "Custom Font",
        fileUrl: config.fileUrl,
        fileFormat: config.fileFormat,
      })
      return
    }
    onChange({ source: "preset", family: config.family || "Inter" })
  }

  async function handleFontFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setUploadError("")
    const result = await uploadProjectAsset(projectId, file)
    setUploading(false)
    if (!result.ok) {
      setUploadError(result.error)
      return
    }
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
    onChange({
      source: "file",
      family: config.family && config.family !== "Inter" ? config.family : baseName || "Custom Font",
      fileUrl: result.url,
      fileFormat: fontFormatFromFilename(file.name),
    })
  }

  const previewFamily = fontFamilyCssLocal(config)

  return (
    <div className="form-group font-select-field" style={{ marginBottom: "0.75rem" }}>
      <label style={{ fontSize: "0.8125rem" }}>{label}</label>

      <div className="font-source-tabs" role="tablist" aria-label={`${label} font source`}>
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={config.source === opt.id}
            className={`font-source-tab${config.source === opt.id ? " active" : ""}`}
            onClick={() => setSource(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {config.source === "preset" && (
        <div className="font-source-panel">
          <input
            list={listId}
            value={config.family}
            onChange={(e) => patch({ family: e.target.value })}
            placeholder="Inter"
            style={{ fontFamily: previewFamily }}
          />
          <datalist id={listId}>
            {FONT_FAMILY_PRESETS.map((font) => (
              <option key={font} value={font} />
            ))}
          </datalist>
          <p className="font-field-hint">System or web-safe fonts already on the device.</p>
        </div>
      )}

      {config.source === "google" && (
        <div className="font-source-panel">
          {!customGoogle ? (
            <select
              value={isListedGoogleFont(config.family) ? config.family : ""}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setCustomGoogle(true)
                  return
                }
                patch({ family: e.target.value })
              }}
              style={{ fontFamily: previewFamily }}
            >
              <option value="" disabled>
                Select a Google Font
              </option>
              {GOOGLE_FONTS.map((font) => (
                <option key={font} value={font} style={{ fontFamily: `"${font}", sans-serif` }}>
                  {font}
                </option>
              ))}
              <option value="__custom__">Custom Google Font…</option>
            </select>
          ) : (
            <input
              value={config.family}
              onChange={(e) => patch({ family: e.target.value })}
              placeholder="e.g. Playfair Display"
              style={{ fontFamily: previewFamily }}
            />
          )}
          {customGoogle && (
            <button
              type="button"
              className="font-link-btn"
              onClick={() => setCustomGoogle(false)}
            >
              ← Back to list
            </button>
          )}
          <label className="font-weights-label">Weights</label>
          <input
            value={config.weights ?? "400;500;600;700"}
            onChange={(e) => patch({ weights: e.target.value })}
            placeholder="400;500;600;700"
          />
          <p className="font-field-hint">Loaded from Google Fonts. Use semicolons between weights.</p>
        </div>
      )}

      {config.source === "file" && (
        <div className="font-source-panel">
          <label className="font-weights-label">Font family name</label>
          <input
            value={config.family}
            onChange={(e) => patch({ family: e.target.value })}
            placeholder="My Brand Font"
            style={{ fontFamily: previewFamily }}
          />

          {config.fileUrl ? (
            <div className="font-file-preview">
              <span className="font-file-name" title={config.fileUrl}>
                {config.fileFormat?.toUpperCase() ?? "FONT"} · {config.fileUrl.split("/").pop()}
              </span>
              <button type="button" className="btn btn-secondary font-file-remove" onClick={() => patch({ fileUrl: undefined })}>
                Remove
              </button>
            </div>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept={FONT_FILE_ACCEPT}
            style={{ display: "none" }}
            onChange={(e) => {
              void handleFontFile(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <div className="font-file-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : config.fileUrl ? "Replace font file" : "Upload font file"}
            </button>
            <span className="font-field-hint">.woff2, .woff, .ttf, .otf via Medusa</span>
          </div>

          <label className="font-weights-label">Or paste font file URL</label>
          <input
            type="url"
            value={config.fileUrl ?? ""}
            onChange={(e) => {
              const url = e.target.value
              patch({
                fileUrl: url || undefined,
                fileFormat: url ? fontFormatFromFilename(url) : config.fileFormat,
              })
            }}
            placeholder="https://…"
          />
          {uploadError ? <p className="font-field-error">{uploadError}</p> : null}
        </div>
      )}

      <p className="font-preview-sample" style={{ fontFamily: previewFamily }}>
        The quick brown fox jumps over the lazy dog.
      </p>
    </div>
  )
}

function fontFamilyCssLocal(config: BrandFontConfig): string | undefined {
  if (!config.family) return undefined
  return `"${config.family}", system-ui, sans-serif`
}
