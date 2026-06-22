"use client"

import { useEffect } from "react"
import { buildBrandFontAssets } from "@/lib/brand-config"

/** Injects Google Fonts links and @font-face rules for brand typography in the builder. */
export function BrandFontStyles({ brand }: { brand: Record<string, unknown> }) {
  useEffect(() => {
    const { googleLink, styleBlock } = buildBrandFontAssets(brand)
    const linkId = "mwb-brand-google-fonts"
    const styleId = "mwb-brand-font-faces"

    let link = document.getElementById(linkId) as HTMLLinkElement | null
    if (googleLink) {
      if (!link) {
        link = document.createElement("link")
        link.id = linkId
        link.rel = "stylesheet"
        document.head.appendChild(link)
      }
      link.href = googleLink
    } else if (link) {
      link.remove()
    }

    let style = document.getElementById(styleId) as HTMLStyleElement | null
    if (styleBlock) {
      if (!style) {
        style = document.createElement("style")
        style.id = styleId
        document.head.appendChild(style)
      }
      style.textContent = styleBlock
    } else if (style) {
      style.remove()
    }

    return () => {
      document.getElementById(linkId)?.remove()
      document.getElementById(styleId)?.remove()
    }
  }, [brand])

  return null
}
