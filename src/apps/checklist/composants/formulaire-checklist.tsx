"use client"

// Formulaire d'écriture de Check-lists : une Server Action, son message d'erreur en français sous le bouton (rôle alert).
// Les champs cachés portent l'identifiant de la fiche ; les champs visibles sont passés en enfants.

import { useActionState, type ReactNode } from "react"

import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON } from "@/lib/classes-formulaire"

type Action = (etat: Resultat | null, donnees: FormData) => Promise<Resultat>

export function FormulaireChecklist({
  action,
  champsCaches = {},
  libelle,
  classe = BOUTON,
  enfants,
  actif,
}: {
  action: Action
  champsCaches?: Record<string, string>
  libelle: string
  classe?: string
  enfants?: ReactNode
  // Choix en cours (statut d'un point) : le marqueur ✓ et aria-pressed se lisent, la couleur seule ne suffit pas.
  actif?: boolean
}) {
  const [etat, envoyer, enCours] = useActionState(action, null)
  return (
    <form action={envoyer} className="flex flex-col gap-3">
      {Object.entries(champsCaches).map(([nom, valeur]) => (
        <input key={nom} type="hidden" name={nom} value={valeur} />
      ))}
      {enfants}
      <div>
        <button type="submit" className={classe} disabled={enCours} aria-pressed={actif}>
          {actif && (
            <span aria-hidden="true" className="mr-1">
              ✓
            </span>
          )}
          {libelle}
        </button>
      </div>
      {etat && !etat.ok && (
        <p role="alert" className="rounded-md border border-etat-rouge px-3 py-2 text-sm text-etat-rouge">
          {etat.message}
        </p>
      )}
    </form>
  )
}
