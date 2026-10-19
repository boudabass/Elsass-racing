"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TiroirAction } from "@/components/formulaire/tiroir"

import { cloturerSaisonAction, creerSaisonAction } from "../actions"
import { CHAMP } from "@/lib/classes-formulaire"

// Nouvelle saison : le bouton ouvre un tiroir de saisie. Année proposée (dernière + 1), dates du 1er janvier au 31 décembre modifiables.
export function FormulaireNouvelleSaison({ prochaineAnnee }: { prochaineAnnee: number }) {
  return (
    <TiroirAction
      libelle="Nouvelle saison"
      titre="Ouvrir une saison"
      action={creerSaisonAction}
      libelleBouton="Ouvrir la saison"
      libelleEnCours="Ouverture…"
      secondaire={false}
    >
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
    </TiroirAction>
  )
}

// Clôture : un tiroir de confirmation qui écrit ce que la clôture change.
export function BoutonClotureSaison({ seasonId }: { seasonId: string }) {
  return (
    <TiroirAction
      libelle="Clôturer la saison"
      titre="Clôturer la saison"
      action={cloturerSaisonAction}
      libelleBouton="Confirmer la clôture"
      libelleEnCours="Clôture…"
      danger
      question="La saison passe en lecture : ses épreuves, engagements et résultats ne se modifient plus. Les statistiques restent visibles."
    >
      <input type="hidden" name="seasonId" value={seasonId} />
    </TiroirAction>
  )
}
