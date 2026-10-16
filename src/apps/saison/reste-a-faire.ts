// Ce qu'il reste à faire sur une épreuve, affiché sur chaque ligne du calendrier. Pur.
// Un seul libellé, le plus urgent : null quand il n'y a rien à faire.

import type { StatutEngagement, StatutEpreuve, ValidationResultat } from "./regles"

export interface EngagementPourReste {
  statut: StatutEngagement
  // Validation du résultat, null s'il n'y en a pas.
  resultat: ValidationResultat | null
}

export interface EpreuvePourReste {
  statut: StatutEpreuve
  engagements: EngagementPourReste[]
}

export function resteAFaire(epreuve: EpreuvePourReste): string | null {
  if (epreuve.statut === "annulee") return null
  if (epreuve.engagements.length === 0) return "Engager une voiture"

  // Une fois l'épreuve commencée, les résultats priment : un parti sans résultat, ou un résultat à valider.
  if (epreuve.statut === "en_cours" || epreuve.statut === "terminee") {
    if (epreuve.engagements.some((engagement) => engagement.statut === "parti" && engagement.resultat === null)) {
      return "Résultat à saisir"
    }
    if (epreuve.engagements.some((engagement) => engagement.resultat === "saisi" || engagement.resultat === "a_verifier" || engagement.resultat === "conteste")) {
      return "Résultat à valider"
    }
  }

  if (epreuve.engagements.some((engagement) => engagement.statut === "envisage" || engagement.statut === "inscrit")) {
    return "Engagement à payer"
  }
  return null
}
