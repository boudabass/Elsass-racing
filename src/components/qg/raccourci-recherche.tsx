"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { naviguer } from "@/core/navigation/naviguer"

// Ctrl+K (ou Cmd+K) ouvre la recherche, sur PC.
export function RaccourciRecherche() {
  const router = useRouter()

  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === "k") {
        evenement.preventDefault()
        naviguer(router, "/recherche")
      }
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [router])

  return null
}
