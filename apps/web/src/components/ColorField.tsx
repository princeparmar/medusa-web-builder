"use client"

import { useEffect, useState } from "react"
import { isValidHexColor, normalizeHexColor } from "@/lib/brand-config"

export function ColorField({
  label,
  value,
  onChange,
  fallback = "#000000",
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  fallback?: string
}) {
  const pickerValue = normalizeHexColor(value || fallback, fallback)
  const [hexInput, setHexInput] = useState(value || fallback)

  useEffect(() => {
    setHexInput(value || fallback)
  }, [value, fallback])

  function syncFromPicker(hex: string) {
    setHexInput(hex)
    onChange(hex)
  }

  function syncFromText(raw: string) {
    setHexInput(raw)
    if (isValidHexColor(raw)) {
      onChange(normalizeHexColor(raw, fallback))
    }
  }

  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="color-field-row">
        <input
          type="color"
          className="color-field-swatch"
          value={pickerValue}
          onChange={(e) => syncFromPicker(e.target.value)}
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          className="color-field-hex"
          value={hexInput}
          placeholder="#1a1a2e"
          spellCheck={false}
          onChange={(e) => syncFromText(e.target.value)}
          onBlur={() => {
            if (!isValidHexColor(hexInput)) {
              const fixed = normalizeHexColor(value || fallback, fallback)
              setHexInput(fixed)
            }
          }}
        />
      </div>
    </div>
  )
}
