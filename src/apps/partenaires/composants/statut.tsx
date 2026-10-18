"use client"

// Statut d'un partenaire : la pastille (mot et couleur) et le changement de statut, par un menu replié.
// Le menu est un <details> : il s'ouvre au clavier comme à la souris, sans glisser-déposer.

import { changerStatutAction } from "../actions"
import { COULEUR_STATUT_PARTENAIRE, LIBELLES_STATUT_PARTENAIRE, STATUTS_SAISIS } from "../affichage"
import type { StatutPartenaire } from "../regles"

import { BoutonEnvoi, FormulaireAction } from "./formulaire"

export function PastilleStatut({ statut }: { statut: StatutPartenaire }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${COULEUR_STATUT_PARTENAIRE[statut]}`}>
      {LIBELLES_STATUT_PARTENAIRE[statut]}
    </span>
  )
}

// Menu « Changer le statut » : les cinq statuts saisis à la main. Partenaire et Ancien partenaire sont automatiques.
export function ChangerStatut({ partnerId, statut, compact = false }: { partnerId: string; statut: StatutPartenaire; compact?: boolean }) {
  const automatique = statut === "partenaire" || statut === "ancien_partenaire"
  const idSelect = `statut-${partnerId}`

  return (
    <details className="group">
      <summary className="cible-tactile inline-flex cursor-pointer list-none items-center text-sm underline underline-offset-4 decoration-marque decoration-2">
        Changer le statut
      </summary>
      <div className="mt-2 flex flex-col gap-2 rounded-md border border-bordure bg-surface p-3">
        {automatique ? (
          <p className="text-sm text-texte-discret">
            Ce statut est automatique. On devient partenaire en signant une convention.
          </p>
        ) : (
          <FormulaireAction action={changerStatutAction} nom="Changer le statut" className="flex flex-col gap-2">
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
            <BoutonEnvoi libelle="Changer le statut" secondaire={compact} />
          </FormulaireAction>
        )}
      </div>
    </details>
  )
}
