"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, CHAMP } from "@/lib/classes-formulaire"

import { creerVehiculeAction } from "../actions"
import { LIBELLE_TYPE_VEHICULE, type TypeVehicule } from "../libelles"

export interface OptionGabarit {
  cle: string
  nom: string
}

// Nouveau véhicule : trois champs. Après l'envoi, la fiche s'ouvre sur l'onglet Identité.
export function FormulaireVehicule({ gabarits }: { gabarits: OptionGabarit[] }) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerVehiculeAction, null)

  useEffect(() => {
    if (resultat?.ok && resultat.id) router.push(`/apps/voiture/vehicules/${resultat.id}?onglet=identite`)
  }, [resultat, router])

  return (
    <form action={action} className="flex flex-col gap-5">
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
        <select name="gabaritCle" defaultValue={gabarits[0]?.cle ?? ""} className={CHAMP}>
          {gabarits.map((gabarit) => (
            <option key={gabarit.cle} value={gabarit.cle}>
              {gabarit.nom}
            </option>
          ))}
          <option value="">Aucun gabarit</option>
        </select>
      </label>

      <div className="flex flex-col gap-3">
        <button type="submit" disabled={enCours} className={`${BOUTON} w-full sm:w-auto`}>
          Ajouter le véhicule
        </button>
        <Message resultat={resultat} />
      </div>
    </form>
  )
}
