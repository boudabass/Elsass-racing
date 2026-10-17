"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { cloturerSaisonAction, creerSaisonAction, type Resultat } from "../actions"
import { CHAMP } from "@/lib/classes-formulaire"
import { Message } from "./formulaires"


// Nouvelle saison : année proposée (dernière + 1), dates du 1er janvier au 31 décembre modifiables.
export function FormulaireNouvelleSaison({ prochaineAnnee }: { prochaineAnnee: number }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerSaisonAction, null)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="annee-saison">Année</Label>
        <Input id="annee-saison" name="annee" inputMode="numeric" required defaultValue={prochaineAnnee} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="debut-saison">Premier jour</Label>
        <Input id="debut-saison" name="dateDebut" type="date" defaultValue={`${prochaineAnnee}-01-01`} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="fin-saison">Dernier jour</Label>
        <Input id="fin-saison" name="dateFin" type="date" defaultValue={`${prochaineAnnee}-12-31`} className={CHAMP} />
      </div>
      <div className="sm:col-span-3">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-3">
        Ouvrir la saison
      </Button>
    </form>
  )
}

// Clôture : en deux temps, avec ce que la clôture change écrit à l'écran.
export function BoutonClotureSaison({ seasonId }: { seasonId: string }) {
  const [confirmer, setConfirmer] = useState(false)
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(cloturerSaisonAction, null)
  if (resultat?.ok) return <p role="status" className="text-sm text-texte-discret">Saison clôturée.</p>
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="seasonId" value={seasonId} />
      {!confirmer ? (
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setConfirmer(true)}>
          Clôturer la saison
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-bordure p-3">
          <p className="text-sm">
            La saison passe en lecture : ses épreuves, engagements et résultats ne se modifient plus. Les statistiques restent visibles.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={enCours} className="min-h-11">
              Confirmer la clôture
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmer(false)}>
              Garder la saison ouverte
            </Button>
          </div>
        </div>
      )}
      <Message resultat={resultat} />
    </form>
  )
}
