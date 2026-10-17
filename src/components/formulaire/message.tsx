"use client"

import type { Resultat } from "@/core/sdk/actions-serveur"

// Message sous un formulaire après une Server Action : le texte de succès (« Enregistré. » par défaut,
// ou celui de `ok`), ou le message français de la garde ou de la règle.
export function Message({ resultat, ok }: { resultat: Resultat | null; ok?: string }) {
  if (!resultat) return null
  return resultat.ok ? (
    <p role="status" className="text-sm text-etat-ok">
      {ok ?? "Enregistré."}
    </p>
  ) : (
    <p role="alert" className="text-sm text-etat-rouge">
      {resultat.message}
    </p>
  )
}
