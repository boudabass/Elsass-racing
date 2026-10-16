"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Ctrl+K (ou Cmd+K) ouvre la recherche, sur PC.
export function RaccourciRecherche() {
  const router = useRouter()

  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === "k") {
        evenement.preventDefault()
        router.push("/recherche")
      }
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [router])

  return null
}
