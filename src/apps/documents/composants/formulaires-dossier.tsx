"use client"

// Formulaires de dossier (brief 5.3, §1 et §5) : créer, renommer, régler la visibilité, supprimer si vide. Un dossier
// type ne se renomme pas et ne se supprime pas : ces gestes n'y sont pas proposés.

import { TiroirAction } from "@/components/formulaire/tiroir"
import { CHAMP } from "@/lib/classes-formulaire"

import { creerDossierAction, modifierDossierAction, supprimerDossierAction } from "../actions"
import { LIBELLE_VISIBILITE } from "../libelles"
import { VISIBILITES, type Visibilite } from "../regles"

export function NouveauDossier() {
  return (
    <TiroirAction libelle="Dossier" secondaire={false} titre="Nouveau dossier" action={creerDossierAction} libelleBouton="Créer le dossier" libelleEnCours="Création…">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nom</span>
        <input name="nom" required maxLength={80} className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Qui peut voir</span>
        <select name="visibilite" aria-label="Qui peut voir" defaultValue="team" className={CHAMP}>
          {VISIBILITES.map((visibilite) => (
            <option key={visibilite} value={visibilite}>
              {LIBELLE_VISIBILITE[visibilite]}
            </option>
          ))}
        </select>
      </label>
    </TiroirAction>
  )
}

export function ModifierDossier({ id, nom, visibilite, systeme }: { id: string; nom: string; visibilite: Visibilite; systeme: boolean }) {
  return (
    <TiroirAction libelle="Modifier le dossier" titre="Modifier le dossier" action={modifierDossierAction} libelleBouton="Enregistrer" libelleEnCours="Enregistrement…">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nom</span>
        {/* Un dossier type garde son nom : le champ reste lisible, sans être modifiable. */}
        <input name="nom" required maxLength={80} defaultValue={nom} readOnly={systeme} className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Qui peut voir</span>
        <select name="visibilite" aria-label="Qui peut voir" defaultValue={visibilite} className={CHAMP}>
          {VISIBILITES.map((valeur) => (
            <option key={valeur} value={valeur}>
              {LIBELLE_VISIBILITE[valeur]}
            </option>
          ))}
        </select>
      </label>
    </TiroirAction>
  )
}

export function SupprimerDossier({ id, nom }: { id: string; nom: string }) {
  return (
    <TiroirAction
      libelle="Supprimer le dossier"
      titre="Supprimer le dossier"
      question={`« ${nom} » disparaîtra. Seul un dossier vide peut être supprimé.`}
      action={supprimerDossierAction}
      libelleBouton="Supprimer"
      libelleEnCours="Suppression…"
      danger
    >
      <input type="hidden" name="id" value={id} />
    </TiroirAction>
  )
}
