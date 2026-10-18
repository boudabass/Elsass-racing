"use client"

import { useActionState, useState } from "react"

import { encaisserRecetteAction, type Resultat } from "../actions"
import { BOUTON, CHAMP } from "./classes"

// Encaisser une recette prévue (brief 3.9, §3) : un bouton, puis la date (aujourd'hui par défaut) et le compte
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
  const [ouvert, setOuvert] = useState(false)
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(encaisserRecetteAction, null)

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className={BOUTON}>
        Encaisser
      </button>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border border-bordure p-4 text-sm">
      <input type="hidden" name="recetteId" value={recetteId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Date d&apos;encaissement</span>
        <input name="date" type="date" defaultValue={dateDefaut} required className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Compte d&apos;arrivée</span>
        <select name="payerId" defaultValue={comptes.find((compte) => compte.parDefaut)?.id} required className={CHAMP}>
          {comptes.map((compte) => (
            <option key={compte.id} value={compte.id}>
              {compte.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enCours} className={BOUTON}>
          Confirmer l&apos;encaissement
        </button>
        <button type="button" onClick={() => setOuvert(false)} className="cible-tactile rounded-md border border-bordure px-5 py-3">
          Annuler
        </button>
      </div>
      {resultat && !resultat.ok && (
        <p role="alert" className="text-sm text-etat-rouge">
          {resultat.message}
        </p>
      )}
    </form>
  )
}
