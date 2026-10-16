"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import { saisirDebriefAction, type Resultat } from "../actions"
import { Message } from "./formulaires"

const CHAMP = "min-h-11 w-full rounded-md border border-bordure bg-surface px-3 py-2 text-texte focus:outline-none focus:ring-2 focus:ring-marque"

// Débrief : ressenti de 1 à 5 par cinq boutons (pas de curseur), puis les textes.
// Le ressenti est le bouton cliqué : il envoie la valeur avec le formulaire.
export function FormulaireDebrief({
  entryId,
  valeurs,
}: {
  entryId: string
  valeurs: { ressenti: number; pointsPositifs: string | null; pointsAAmeliorer: string | null; problemesVoiture: string | null } | null
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(saisirDebriefAction, null)
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="entryId" value={entryId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-texte-discret">Ton ressenti (clique sur une valeur)</legend>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((note) => (
            <Button
              key={note}
              type="submit"
              name="ressenti"
              value={String(note)}
              disabled={enCours}
              variant={valeurs?.ressenti === note ? "default" : "outline"}
              aria-label={`Ressenti ${note} sur 5`}
              aria-pressed={valeurs?.ressenti === note}
              className="min-h-11"
            >
              {note}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`positifs-${entryId}`}>Points positifs</Label>
        <textarea id={`positifs-${entryId}`} name="pointsPositifs" rows={2} defaultValue={valeurs?.pointsPositifs ?? ""} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`ameliorer-${entryId}`}>Points à améliorer</Label>
        <textarea id={`ameliorer-${entryId}`} name="pointsAAmeliorer" rows={2} defaultValue={valeurs?.pointsAAmeliorer ?? ""} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`voiture-${entryId}`}>Problèmes de voiture constatés</Label>
        <textarea id={`voiture-${entryId}`} name="problemesVoiture" rows={2} defaultValue={valeurs?.problemesVoiture ?? ""} className={CHAMP} />
      </div>
      <Message resultat={resultat} />
    </form>
  )
}
