"use client"

import { TiroirAction } from "@/components/formulaire/tiroir"

import { encaisserRecetteAction } from "../actions"
import { CHAMP } from "./classes"

// Encaisser une recette prévue (brief 3.9, §3). Le bouton ouvre un tiroir : la date (aujourd'hui par défaut) et le compte
// d'arrivée (la caisse de la team par défaut). Le bouton n'apparaît qu'au niveau gestion ; le service vérifie le reste.
export function EncaisserRecette({
  recetteId,
  comptes,
  dateDefaut,
}: {
  recetteId: string
  comptes: Array<{ id: string; nom: string; parDefaut: boolean }>
  dateDefaut: string
}) {
  return (
    <TiroirAction
      libelle="Encaisser"
      titre="Encaisser la recette"
      action={encaisserRecetteAction}
      libelleBouton="Confirmer l'encaissement"
      libelleEnCours="Encaissement…"
      secondaire={false}
    >
      <input type="hidden" name="recetteId" value={recetteId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Date d&apos;encaissement</span>
        <input name="date" type="date" defaultValue={dateDefaut} required className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Compte d&apos;arrivée</span>
        <select name="payerId" defaultValue={comptes.find((compte) => compte.parDefaut)?.id} required className={CHAMP}>
          {comptes.map((compte) => (
            <option key={compte.id} value={compte.id}>
              {compte.nom}
            </option>
          ))}
        </select>
      </label>
    </TiroirAction>
  )
}
