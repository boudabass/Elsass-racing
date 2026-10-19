"use client"

// Statut d'un partenaire : la pastille (mot et couleur) et le changement de statut, dans un tiroir de choix (brief 3.13b).

import { TiroirAction } from "@/components/formulaire/tiroir"

import { changerStatutAction } from "../actions"
import { COULEUR_STATUT_PARTENAIRE, LIBELLES_STATUT_PARTENAIRE, STATUTS_SAISIS } from "../affichage"
import type { StatutPartenaire } from "../regles"

export function PastilleStatut({ statut }: { statut: StatutPartenaire }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${COULEUR_STATUT_PARTENAIRE[statut]}`}>
      {LIBELLES_STATUT_PARTENAIRE[statut]}
    </span>
  )
}

// Changement de statut : les cinq statuts saisis à la main, dans un tiroir de choix. Partenaire et Ancien partenaire sont automatiques.
export function ChangerStatut({ partnerId, statut }: { partnerId: string; statut: StatutPartenaire; compact?: boolean }) {
  const automatique = statut === "partenaire" || statut === "ancien_partenaire"
  const idSelect = `statut-${partnerId}`

  if (automatique) {
    return <p className="text-sm text-texte-discret">Ce statut est automatique. On devient partenaire en signant une convention.</p>
  }

  return (
    <TiroirAction libelle="Changer le statut" titre="Changer le statut" action={changerStatutAction} libelleBouton="Enregistrer le statut" libelleEnCours="Enregistrement…">
      <input type="hidden" name="partnerId" value={partnerId} />
      <label htmlFor={idSelect} className="text-sm font-medium">
        Nouveau statut
      </label>
      <select id={idSelect} name="statut" defaultValue={statut} className="min-h-11 w-full rounded-md border border-bordure-champ bg-surface px-3 py-2 text-texte focus:outline-none focus:ring-2 focus:ring-marque">
        {STATUTS_SAISIS.map((choix) => (
          <option key={choix} value={choix}>
            {LIBELLES_STATUT_PARTENAIRE[choix]}
          </option>
        ))}
      </select>
    </TiroirAction>
  )
}
