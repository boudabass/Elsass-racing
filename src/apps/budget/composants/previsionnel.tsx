"use client"

import { TiroirAction } from "@/components/formulaire/tiroir"

import { enregistrerPrevisionnelAction } from "../actions"
import { formatEuros } from "../libelles"
import { enEuros } from "./formulaires"
import { CHAMP } from "./classes"

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

// Prévisionnel : une grille (catégorie, prévu, réel, écart), en lecture. Avec le droit d'écriture, « Modifier les prévus »
// ouvre un tiroir qui porte les montants prévus, une ligne par catégorie (brief 3.13b : fiche en lecture, puis tiroir).
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
  return (
    <div className="flex flex-col gap-3">
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
              <span className="chiffre sm:row-start-1 sm:col-start-2 sm:text-right">
                {ligne.prevu === null ? <span className="text-texte-discret">Pas prévu</span> : formatEuros(ligne.prevu)}
              </span>
              <span className="chiffre text-texte sm:row-start-1 sm:col-start-3 sm:text-right">{formatEuros(ligne.reel)}</span>
            </div>
          </li>
        ))}
      </ul>

      {modifiable && (
        <div>
          <TiroirAction
            libelle="Modifier les prévus"
            titre="Modifier les prévus"
            action={enregistrerPrevisionnelAction}
            libelleBouton="Enregistrer les prévus"
            libelleEnCours="Enregistrement…"
          >
            <input type="hidden" name="seasonId" value={seasonId} />
            {eventId && <input type="hidden" name="eventId" value={eventId} />}
            {lignes.map((ligne) => (
              <label key={ligne.categorieId} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{ligne.nom} (prévu, €)</span>
                <input
                  name={`prevu-${ligne.categorieId}`}
                  inputMode="decimal"
                  defaultValue={ligne.prevu === null ? "" : enEuros(ligne.prevu)}
                  placeholder="0,00"
                  className={`${CHAMP} text-right chiffre`}
                />
              </label>
            ))}
          </TiroirAction>
        </div>
      )}
    </div>
  )
}
