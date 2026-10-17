"use client"

import { useActionState } from "react"

import { enregistrerPrevisionnelAction, type Resultat } from "../actions"
import { formatEuros } from "../libelles"
import { enEuros } from "./formulaires"
import { BOUTON } from "./classes"

export interface LignePrevu {
  categorieId: string
  nom: string
  prevu: number | null
  reel: number
  // Phrase d'écart, et couleur pour le renfort visuel.
  ecart: string
  couleur: "vert" | "orange" | "rouge" | null
}

const COULEUR: Record<string, string> = { vert: "text-etat-ok", orange: "text-etat-orange", rouge: "text-etat-rouge" }

// Prévisionnel : une grille (catégorie, prévu, réel, écart). Le prévu se saisit sur la ligne ; un seul bouton
// enregistre toutes les lignes remplies. Sans droit d'écriture (modifiable = faux), seulement les valeurs.
export function GrillePrevisionnel({
  seasonId,
  eventId,
  lignes,
  modifiable,
  cle,
}: {
  seasonId: string
  eventId: string | null
  lignes: LignePrevu[]
  modifiable: boolean
  cle: string
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(enregistrerPrevisionnelAction, null)

  const contenu = (
    <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
      {lignes.map((ligne) => (
        <li
          key={`${cle}-${ligne.categorieId}`}
          className="flex flex-col gap-1 px-4 py-2 text-sm sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_9rem_minmax(0,16rem)] sm:items-center sm:gap-x-4 sm:py-2.5"
        >
          <div className="flex items-baseline justify-between gap-3 sm:contents">
            <span className="min-w-0 break-words font-medium sm:row-start-1 sm:col-start-1">{ligne.nom}</span>
            <span className={`${ligne.couleur ? COULEUR[ligne.couleur] : "text-texte-discret"} text-right font-medium sm:row-start-1 sm:col-start-4 sm:text-left`}>
              {ligne.prevu === null && ligne.reel === 0 ? (
                // Rien de prévu ni dépensé : un tiret discret ; le sens reste lu par les lecteurs d'écran.
                <>
                  <span aria-hidden="true" className="text-texte-discret">—</span>
                  <span className="sr-only">{ligne.ecart}</span>
                </>
              ) : (
                ligne.ecart
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 sm:contents">
            <span className="sm:row-start-1 sm:col-start-2 sm:text-right">
              {modifiable ? (
                <label className="flex items-center justify-end gap-1">
                  <span className="sr-only">Prévu pour {ligne.nom} (€)</span>
                  <input
                    name={`prevu-${ligne.categorieId}`}
                    inputMode="decimal"
                    defaultValue={ligne.prevu === null ? "" : enEuros(ligne.prevu)}
                    placeholder="0,00"
                    className="min-h-11 w-full max-w-32 rounded-md border border-bordure-champ bg-fond px-3 py-1 text-right text-texte focus:outline-none focus:ring-2 focus:ring-marque chiffre"
                  />
                </label>
              ) : (
                <span className="chiffre">{ligne.prevu === null ? <span className="text-texte-discret">Pas prévu</span> : formatEuros(ligne.prevu)}</span>
              )}
            </span>
            <span className="chiffre text-texte sm:row-start-1 sm:col-start-3 sm:text-right">{formatEuros(ligne.reel)}</span>
          </div>
        </li>
      ))}
    </ul>
  )

  if (!modifiable) return contenu

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="seasonId" value={seasonId} />
      {eventId && <input type="hidden" name="eventId" value={eventId} />}
      {contenu}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enCours} className={BOUTON}>
          Enregistrer les prévus
        </button>
        {resultat &&
          (resultat.ok ? (
            <p role="status" className="text-sm text-etat-ok">
              Enregistré.
            </p>
          ) : (
            <p role="alert" className="text-sm text-etat-rouge">
              {resultat.message}
            </p>
          ))}
      </div>
    </form>
  )
}
