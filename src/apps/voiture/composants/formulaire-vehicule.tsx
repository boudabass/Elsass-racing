"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { CHAMP } from "@/lib/classes-formulaire"

import { creerVehiculeAction } from "../actions"
import { CLE_GABARIT_GENERIQUE } from "../gabarits"
import { LIBELLE_TYPE_VEHICULE, type TypeVehicule } from "../libelles"

export interface OptionGabarit {
  cle: string
  nom: string
}

// Nouveau véhicule : trois champs, sur sa page (brief 3.13b, décision 1) : la barre du bas envoie, « Annuler » quitte.
// Après l'envoi, la fiche s'ouvre sur l'onglet Identité.
export function FormulaireVehicule({ gabarits }: { gabarits: OptionGabarit[] }) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerVehiculeAction, null)

  useEffect(() => {
    if (resultat?.ok && resultat.id) router.push(`/apps/voiture/vehicules/${resultat.id}?onglet=identite`)
  }, [resultat, router])

  return (
    <FormulairePage formulaireId="vehicule-formulaire" annulerHref="/apps/voiture" libelleBouton="Ajouter le véhicule" enCours={enCours}>
      <form id="vehicule-formulaire" action={action} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nom</span>
          <input name="nom" required maxLength={60} placeholder="Saxo 2" className={CHAMP} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Type</span>
          <select name="type" defaultValue="course" className={CHAMP}>
            {(Object.keys(LIBELLE_TYPE_VEHICULE) as TypeVehicule[]).map((type) => (
              <option key={type} value={type}>
                {LIBELLE_TYPE_VEHICULE[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Gabarit</span>
          <select name="gabaritCle" defaultValue={CLE_GABARIT_GENERIQUE} className={CHAMP}>
            {gabarits.map((gabarit) => (
              <option key={gabarit.cle} value={gabarit.cle}>
                {gabarit.nom}
              </option>
            ))}
            <option value="">Aucun gabarit</option>
          </select>
        </label>

        <Message resultat={resultat} />
      </form>
    </FormulairePage>
  )
}
