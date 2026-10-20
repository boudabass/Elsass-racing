"use client"

// Pages « Pièce » et « Roulage » du bouton + (tâche 4.2, §4). Chacune est une page entière qui finit comme un tiroir :
// la barre du bas envoie, « Annuler » quitte. Après l'envoi, on revient à l'écran concerné (le stock ou l'atelier).

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { CHAMP } from "@/lib/classes-formulaire"

import { ajouterRoulageAction, creerPieceAction } from "../actions"

import { ChampsPiece } from "./formulaires-stock"

interface FormulairePieceNouvelleProps {
  vehicleId: string
  organes: Array<{ componentTypeId: string; nom: string }>
  fournisseurs: Array<{ id: string; nom: string }>
}

// Ajouter une pièce au stock de la voiture choisie. Le prix et le fournisseur sont là : la page n'existe qu'au niveau écriture.
export function FormulairePieceNouvelle({ vehicleId, organes, fournisseurs }: FormulairePieceNouvelleProps) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerPieceAction, null)
  const retour = `/apps/garage/stock?vehicule=${vehicleId}`

  useEffect(() => {
    if (resultat?.ok) router.push(retour)
  }, [resultat, retour, router])

  return (
    <FormulairePage formulaireId="piece-formulaire" annulerHref={retour} libelleBouton="Ajouter la pièce" libelleEnCours="Enregistrement…" enCours={enCours}>
      <form id="piece-formulaire" action={action} className="flex flex-col gap-5">
        <ChampsPiece vehicleId={vehicleId} organes={organes} fournisseurs={fournisseurs} />
      </form>
      <Message resultat={resultat} />
    </FormulairePage>
  )
}

interface FormulaireRoulageProps {
  vehicleId: string
}

// Usure manuelle : les kilomètres roulés et l'épreuve (comptée ou non) s'ajoutent à l'usure des organes de la voiture.
export function FormulaireRoulage({ vehicleId }: FormulaireRoulageProps) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(ajouterRoulageAction, null)
  const retour = `/apps/garage?vehicule=${vehicleId}`

  useEffect(() => {
    if (resultat?.ok) router.push(retour)
  }, [resultat, retour, router])

  return (
    <FormulairePage formulaireId="roulage-formulaire" annulerHref={retour} libelleBouton="Enregistrer le roulage" libelleEnCours="Enregistrement…" enCours={enCours}>
      <form id="roulage-formulaire" action={action} className="flex flex-col gap-5">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Kilomètres roulés</span>
          <input name="km" type="number" inputMode="numeric" min={0} max={100000} step={1} placeholder="0" className={CHAMP} />
          <span className="text-texte-discret">Vides, ils valent 0. Une épreuve seule suffit.</span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input name="epreuve" type="checkbox" className="size-5" />
          <span className="font-medium">Épreuve comptée</span>
        </label>
      </form>
      <Message resultat={resultat} />
    </FormulairePage>
  )
}
