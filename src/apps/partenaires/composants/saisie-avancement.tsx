"use client"

// Avancement d'une contrepartie : un champ nombre entouré de deux boutons − et + de 44 px.

import { useState } from "react"

import { CHAMP } from "@/lib/classes-formulaire"

import { saisirAvancementAction } from "../actions"

import { BoutonEnvoi, FormulaireAction } from "./formulaire"

const BOUTON_PAS = "cible-tactile inline-flex min-w-11 items-center justify-center rounded-md border border-bordure text-lg hover:bg-surface-2 disabled:opacity-50"

export function SaisieAvancement({ benefitId, quantiteTenue, quantitePromise }: { benefitId: string; quantiteTenue: number; quantitePromise: number }) {
  const [valeur, setValeur] = useState(quantiteTenue)
  const borner = (nombre: number) => Math.min(999, Math.max(0, nombre))

  return (
    <FormulaireAction action={saisirAvancementAction} nom="Saisir l'avancement" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="benefitId" value={benefitId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`avancement-${benefitId}`} className="text-sm font-medium">
          Réalisé sur {quantitePromise}
        </label>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Retirer une unité" onClick={() => setValeur((v) => borner(v - 1))} className={BOUTON_PAS}>
            −
          </button>
          <input
            id={`avancement-${benefitId}`}
            name="quantiteTenue"
            type="number"
            min={0}
            max={999}
            value={valeur}
            onChange={(e) => setValeur(borner(Number(e.target.value) || 0))}
            className={`${CHAMP} w-24 text-center`}
          />
          <button type="button" aria-label="Ajouter une unité" onClick={() => setValeur((v) => borner(v + 1))} className={BOUTON_PAS}>
            +
          </button>
        </div>
      </div>
      <BoutonEnvoi libelle="Enregistrer l'avancement" secondaire />
    </FormulaireAction>
  )
}
