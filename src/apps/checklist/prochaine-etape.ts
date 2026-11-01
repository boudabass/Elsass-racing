// Bouton Prochaine étape de Check-lists (tâche 5.6, §3) : une règle pure, testée. Ordre : le point critique ouvert le
// plus proche de son échéance, puis mes points à faire, puis la liste de la phase suivante. Les candidats viennent du
// serveur (widgets-serveur.ts) : la règle ne lit rien.
import { ORDRE_PHASES, type PhaseEpreuve } from "./regles"

export type RaisonEtape = "critique" | "pour_moi" | "phase_suivante"

export interface CandidatEtape {
  raison: RaisonEtape
  listeId: string
  listeTitre: string
  // Point à traiter. Absent pour « phase_suivante » : c'est la liste qu'il faut ouvrir.
  pointId: string | null
  libelle: string | null
  // Échéance de la liste (AAAA-MM-JJ), null si la liste n'en a pas.
  echeance: string | null
}

const RANG: Record<RaisonEtape, number> = { critique: 0, pour_moi: 1, phase_suivante: 2 }

// Échéance la plus proche d'abord ; sans échéance, en dernier.
export function comparerEcheance(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

function comparerCandidats(a: CandidatEtape, b: CandidatEtape): number {
  return RANG[a.raison] - RANG[b.raison] || comparerEcheance(a.echeance, b.echeance)
}

// Le premier candidat selon l'ordre ci-dessus. À égalité, le premier de la liste gagne.
export function prochaineEtape(candidats: readonly CandidatEtape[]): CandidatEtape | null {
  let meilleur: CandidatEtape | null = null
  for (const candidat of candidats) {
    if (meilleur === null || comparerCandidats(candidat, meilleur) < 0) meilleur = candidat
  }
  return meilleur
}

// Phase qui suit celle-ci dans l'ordre (956 §1). Null après le retour.
export function phaseSuivante(phase: PhaseEpreuve): PhaseEpreuve | null {
  const rang = ORDRE_PHASES.indexOf(phase)
  return rang >= 0 && rang < ORDRE_PHASES.length - 1 ? ORDRE_PHASES[rang + 1] : null
}
