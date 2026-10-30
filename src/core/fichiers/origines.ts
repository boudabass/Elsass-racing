// Registre des origines de fichiers (tâche 5.4, brief §1 « Tous les fichiers »). Comme src/core/notes/fiches.ts : chaque
// app déclare, par type de fiche qui porte un fichier, comment la fiche se voit et comment elle s'ouvre. Documents n'importe
// que ce registre ; le registre importe les fonctions des apps, jamais l'inverse.
//
// Règle : un type de fiche non déclaré n'est pas affiché. Un type déclaré mais masqué en 5.4 porte la raison (`masque`).

import type { ContexteTeam } from "@/core/contexte"
import type { FicheOrigine, OrigineFichier } from "./types-origine"
import { grouperParOrigine, type RattachementFichier } from "./origines-regles"

import { origineVersionsDocuments } from "@/apps/documents/origine-fichiers"
import { origineDepensesBudget } from "@/apps/budget/origine-fichiers"
import { origineAffectationPhoto, origineVehicule, originePapier } from "@/apps/voiture/origine-fichiers"

export type { FicheOrigine, OrigineFichier } from "./types-origine"
export { origineDeclaree, grouperParOrigine, type RattachementFichier } from "./origines-regles"

// Un type déclaré mais pas encore branché : aucune fiche n'est affichée, la raison est dite.
function masque(app: string, ficheType: string, raison: string): OrigineFichier {
  return { app, ficheType, masque: raison, fichesVisibles: async () => [] }
}

const RAISON_ASSISTANCE_EQUIPE = "Règle d'assistance d'Équipe à brancher (5.4, à confirmer par l'orchestrateur)"
const RAISON_PARTENAIRES = "Lecture partagée de Partenaires à écrire (5.4, à confirmer par l'orchestrateur)"

export const ORIGINES: readonly OrigineFichier[] = [
  // Affichés en 5.4
  origineVehicule,
  originePapier,
  origineDepensesBudget,
  origineVersionsDocuments,
  // Déclarés, masqués en 5.4
  origineAffectationPhoto,
  masque("equipe", "licence", RAISON_ASSISTANCE_EQUIPE),
  masque("equipe", "gear", RAISON_ASSISTANCE_EQUIPE),
  masque("equipe", "skill", RAISON_ASSISTANCE_EQUIPE),
  masque("partenaires", "partner", RAISON_PARTENAIRES),
  masque("partenaires", "agreement", RAISON_PARTENAIRES),
  masque("partenaires", "report", RAISON_PARTENAIRES),
  masque("partenaires", "amendment", RAISON_PARTENAIRES),
  masque("partenaires", "proof", RAISON_PARTENAIRES),
  masque("saison", "result", "Résultat de Saison : preuves à rattacher à l'épreuve (5.4, à confirmer)"),
  masque("settings", "team", "Logo de la team : réservé au responsable (5.4, à confirmer)"),
  masque("garage", "ordre", "Photos d'ordre de travail : à brancher sur la règle de Garage (5.4, à confirmer)"),
]

export const cleFiche = (rattachement: RattachementFichier) => `${rattachement.app}:${rattachement.ficheType}:${rattachement.ficheId}`

// Fiche d'origine de chaque rattachement visible par la personne. Un rattachement absent du résultat n'est pas montré.
export async function resoudreOrigines(ctx: ContexteTeam, rattachements: readonly RattachementFichier[]): Promise<Map<string, FicheOrigine>> {
  const resultat = new Map<string, FicheOrigine>()
  for (const [origine, ids] of Array.from(grouperParOrigine(ORIGINES, rattachements))) {
    const fiches = await origine.fichesVisibles(ctx, Array.from(new Set(ids)))
    for (const fiche of fiches) resultat.set(`${origine.app}:${origine.ficheType}:${fiche.id}`, fiche)
  }
  return resultat
}
