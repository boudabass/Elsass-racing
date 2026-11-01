"use server"

// Server Actions de Check-lists (tâche 5.6). N'exportent que des enveloppes des fonctions gardées de services-serveur.ts :
// chacune contrôle elle-même la session et les droits (la garde est dans le service). Renvoient un Resultat.

import { exigerContexte } from "@/core/droits/garde-serveur"
import { ErreurMetier, executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"
import { fixerModeTerrain } from "@/apps/settings/preferences-serveur"

import {
  ajouterPoint,
  ajouterPointAuModele,
  ajouterPointModele,
  ajouterSectionModele,
  changerStatutPoint,
  copierModele,
  creerListeVierge,
  creerModele,
  modifierPoint,
  retirerPoint,
  retirerPointModele,
  type Phase,
  type Portee,
  type RoleSuggere,
  type TypeLien,
} from "./services-serveur"
import type { EcheanceRelative, StatutPoint } from "./regles"

const CHEMIN = "/apps/checklist"

const STATUTS: readonly StatutPoint[] = ["a_faire", "fait", "sans_objet", "probleme"]
const PHASES: readonly Phase[] = ["avant_depart", "verifications", "reconnaissances", "epreuve", "retour"]
const PORTEES: readonly Portee[] = ["engagement", "epreuve"]
const TYPES_LIEN: readonly TypeLien[] = [
  "aucun",
  "organe_garage",
  "train_pneus",
  "papier_voiture",
  "logo_voiture",
  "licence_equipe",
  "homologation_equipe",
  "contrepartie_partenaires",
  "document_documents",
]
const ECHEANCES: readonly EcheanceRelative[] = ["j_moins_7", "j_moins_1", "jour_j"]

// Une valeur saisie doit faire partie de la liste permise, sinon refus avec le nom du champ.
function choisi<T extends string>(valeur: string, permis: readonly T[], nom: string): T {
  if (!permis.includes(valeur as T)) throw new ErreurMetier(`${nom} : valeur inconnue.`)
  return valeur as T
}

// Case à cocher : présente dans le formulaire quand elle est cochée.
function coche(donnees: FormData, cle: string): boolean {
  return donnees.get(cle) === "on"
}

export async function changerStatutPointAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await changerStatutPoint(texte(donnees, "pointId"), choisi(texte(donnees, "statut"), STATUTS, "Statut"))
  })
}

export async function modifierNotePointAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await modifierPoint(texte(donnees, "pointId"), { note: texteOuNull(donnees, "note") })
  })
}

export async function ajouterPointAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await ajouterPoint(texte(donnees, "sectionId"), { libelle: texte(donnees, "libelle"), critique: coche(donnees, "critique") })
  })
}

export async function retirerPointAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => retirerPoint(texte(donnees, "pointId")))
}

export async function creerListeViergeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () =>
    creerListeVierge(texte(donnees, "epreuveId"), null, {
      titre: texte(donnees, "titre"),
      phase: choisi(texte(donnees, "phase"), PHASES, "Phase"),
      ouverteAssistance: coche(donnees, "ouverteAssistance"),
    }),
  )
}

// « Ajouter au modèle » (débrief) : gestion seulement, vérifié dans le service.
export async function ajouterAuModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => ajouterPointAuModele(texte(donnees, "pointId")))
}

export async function creerModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () =>
    creerModele({
      nom: texte(donnees, "nom"),
      portee: choisi(texte(donnees, "portee"), PORTEES, "Portée"),
      phase: texteOuNull(donnees, "phase") ? choisi(texte(donnees, "phase"), PHASES, "Phase") : null,
    }),
  )
}

export async function copierModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => copierModele(texte(donnees, "modeleId")))
}

export async function ajouterSectionModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => ajouterSectionModele(texte(donnees, "modeleId"), texte(donnees, "titre")))
}

export async function ajouterPointModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () =>
    ajouterPointModele(texte(donnees, "sectionId"), {
      libelle: texte(donnees, "libelle"),
      critique: coche(donnees, "critique"),
      roleSuggere: texteOuNull(donnees, "roleSuggere") ? (choisi(texte(donnees, "roleSuggere"), ["equipage", "assistance"], "Rôle") as RoleSuggere) : null,
      echeanceRelative: texteOuNull(donnees, "echeanceRelative") ? choisi(texte(donnees, "echeanceRelative"), ECHEANCES, "Échéance") : null,
      lienType: choisi(texte(donnees, "lienType") || "aucun", TYPES_LIEN, "Type de lien"),
    }),
  )
}

export async function retirerPointModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => retirerPointModele(texte(donnees, "pointId")))
}

// Mode terrain : une préférence du membre, la même que dans Réglages (pas de second réglage).
export async function basculerModeTerrainAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    const { contexte } = await exigerContexte()
    await fixerModeTerrain(contexte, coche(donnees, "actif"))
  })
}
