"use client"

// Bouton « Préparer l'atelier » (brief 4.1, action explicite) : pose les organes par défaut d'une voiture qui n'en a pas
// encore. Sous le niveau écriture, il reste visible mais désactivé, avec la raison à côté (règle 8).

import { useActionState } from "react"

import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON } from "@/lib/classes-formulaire"

import { preparerAtelierAction } from "../actions"

export function BoutonPreparerAtelier({ vehicleId, possible, raison }: { vehicleId: string; possible: boolean; raison: string | null }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(preparerAtelierAction, null)

  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <button type="submit" disabled={!possible || enCours} className={BOUTON}>
        Préparer l&apos;atelier
      </button>
      {!possible && raison && <p className="text-sm text-texte-discret">{raison}</p>}
      <Message resultat={resultat} />
    </form>
  )
}
