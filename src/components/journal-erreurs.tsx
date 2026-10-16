"use client"

import { useEffect } from "react"

import { envoyerErreursEnAttente, journaliserErreur } from "@/core/erreurs/client"

// Écouteurs globaux : erreurs non rattrapées et rejets de promesses. Au chargement et au retour du
// réseau, les erreurs gardées hors ligne partent.
export function JournalErreurs() {
  useEffect(() => {
    function surErreur(evenement: ErrorEvent) {
      void journaliserErreur(evenement.error instanceof Error ? evenement.error : { message: evenement.message })
    }
    function surRejet(evenement: PromiseRejectionEvent) {
      const raison = evenement.reason
      void journaliserErreur(raison instanceof Error ? raison : { message: String(raison) })
    }
    function surReseau() {
      void envoyerErreursEnAttente()
    }

    window.addEventListener("error", surErreur)
    window.addEventListener("unhandledrejection", surRejet)
    window.addEventListener("online", surReseau)
    void envoyerErreursEnAttente()

    return () => {
      window.removeEventListener("error", surErreur)
      window.removeEventListener("unhandledrejection", surRejet)
      window.removeEventListener("online", surReseau)
    }
  }, [])

  return null
}
