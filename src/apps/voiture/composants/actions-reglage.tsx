"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"

import { Message } from "@/components/formulaire/message"
import { TiroirAction } from "@/components/formulaire/tiroir"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, CHAMP } from "@/lib/classes-formulaire"

import { enregistrerCommeReferenceAction, masquerChampsAction, supprimerReglageAction } from "../actions"

// Suppression d'une fiche : un tiroir de confirmation, sans confirm() du navigateur. Après réussite, retour à la liste.
export function SupprimerReglage({ reglageId, vehicleId }: { reglageId: string; vehicleId: string }) {
  const router = useRouter()
  return (
    <TiroirAction
      libelle="Supprimer la fiche"
      titre="Supprimer cette fiche"
      action={supprimerReglageAction}
      libelleBouton="Confirmer la suppression"
      libelleEnCours="Suppression…"
      danger
      question="Supprimer cette fiche de réglage ? Elle disparaît de la liste."
      onSucces={() => router.push(`/apps/voiture/vehicules/${vehicleId}?onglet=reglages`)}
    >
      <input type="hidden" name="reglageId" value={reglageId} />
    </TiroirAction>
  )
}

// Enregistrer la fiche comme référence : demande un nom, par exemple « Asphalte sec ». Dans un tiroir (brief 3.13b).
export function EnregistrerReference({ reglageId }: { reglageId: string }) {
  return (
    <TiroirAction
      libelle="Enregistrer comme référence"
      titre="Enregistrer comme référence"
      action={enregistrerCommeReferenceAction}
      libelleBouton="Enregistrer la référence"
      libelleEnCours="Enregistrement…"
    >
      <input type="hidden" name="reglageId" value={reglageId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nom de la référence</span>
        <input name="nom" required maxLength={60} placeholder="Asphalte sec" className={CHAMP} />
      </label>
    </TiroirAction>
  )
}

// Champs masqués de la team : une case par champ avancé. Les essentiels n'apparaissent pas ici.
// Reste une page de configuration (décision 1 : grille de cases à cocher, exception documentée).
export function FormulaireChampsMasques({ groupes }: { groupes: Array<{ titre: string; champs: Array<{ cle: string; libelle: string; masque: boolean }> }> }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(masquerChampsAction, null)
  return (
    <form action={action} className="flex flex-col gap-6">
      {groupes.map((groupe) => (
        <fieldset key={groupe.titre} className="flex flex-col gap-2">
          <legend className="font-titre text-lg uppercase">{groupe.titre}</legend>
          {groupe.champs.map((champ) => (
            <label key={champ.cle} className="cible-tactile flex items-center gap-3 text-sm">
              <input type="checkbox" name="masque" value={champ.cle} defaultChecked={champ.masque} className="h-5 w-5" />
              {champ.libelle}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="flex flex-col gap-3">
        <button type="submit" disabled={enCours} className={`${BOUTON} w-full sm:w-auto`}>
          Enregistrer
        </button>
        <Message resultat={resultat} ok="Champs enregistrés." />
      </div>
    </form>
  )
}
