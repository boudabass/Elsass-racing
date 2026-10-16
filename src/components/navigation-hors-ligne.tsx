"use client"

import { useEffect } from "react"

import { modeNavigation } from "@/core/navigation/choix"

// Hors ligne, un clic sur un lien interne devient une navigation de page (window.location). En phase
// de capture, avant les gestionnaires de Next : la navigation client, qui demanderait une requête RSC,
// ne part pas. En ligne, rien ne change.
export function NavigationHorsLigne() {
  useEffect(() => {
    function surClic(evenement: MouseEvent) {
      if (modeNavigation(navigator.onLine) === "client") return
      if (evenement.defaultPrevented || evenement.button !== 0) return
      if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return

      const cible = evenement.target instanceof Element ? evenement.target.closest("a[href]") : null
      if (!(cible instanceof HTMLAnchorElement)) return
      if (cible.target && cible.target !== "_self") return
      if (cible.origin !== window.location.origin) return

      evenement.preventDefault()
      evenement.stopImmediatePropagation()
      window.location.assign(cible.href)
    }

    window.addEventListener("click", surClic, true)
    return () => window.removeEventListener("click", surClic, true)
  }, [])

  return null
}
