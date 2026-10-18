"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import { enregistrerCommeReferenceAction, masquerChampsAction, supprimerReglageAction } from "../actions"

// Suppression d'une fiche : la confirmation se fait sur la page, sans confirm() du navigateur.
export function SupprimerReglage({ reglageId, vehicleId }: { reglageId: string; vehicleId: string }) {
  const router = useRouter()
  const [demande, setDemande] = useState(false)
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(supprimerReglageAction, null)

  useEffect(() => {
    if (resultat?.ok) router.push(`/apps/voiture/vehicules/${vehicleId}?onglet=reglages`)
  }, [resultat, router, vehicleId])

  if (!demande) {
    return (
      <button type="button" onClick={() => setDemande(true)} className="cible-tactile self-start text-sm text-etat-rouge underline underline-offset-4">
        Supprimer la fiche
      </button>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-2 text-sm">
      <input type="hidden" name="reglageId" value={reglageId} />
      <p>Supprimer cette fiche de réglage ? Elle disparaît de la liste.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
          Confirmer la suppression
        </button>
        <button type="button" onClick={() => setDemande(false)} className={BOUTON_SECONDAIRE}>
          Annuler
        </button>
      </div>
      <Message resultat={resultat} />
    </form>
  )
}

// Enregistrer la fiche comme référence : demande un nom, par exemple « Asphalte sec ».
export function EnregistrerReference({ reglageId }: { reglageId: string }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(enregistrerCommeReferenceAction, null)
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="reglageId" value={reglageId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nom de la référence</span>
        <input name="nom" required maxLength={60} placeholder="Asphalte sec" className={CHAMP} />
      </label>
      <div className="flex flex-col gap-3">
        <button type="submit" disabled={enCours} className={`${BOUTON_SECONDAIRE} w-full sm:w-auto`}>
          Enregistrer comme référence
        </button>
        <Message resultat={resultat} ok="Référence enregistrée." />
      </div>
    </form>
  )
}

// Champs masqués de la team : une case par champ avancé. Les essentiels n'apparaissent pas ici.
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
