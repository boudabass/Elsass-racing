// Préparation pour l'épreuve : les cinq points bloquants d'un engagement et son indice. Règles pures.
// Un point « pas encore suivi » n'existe pas encore (son app n'est pas construite, ou aucun signal reçu) :
// il n'entre pas dans l'indice et ne bloque rien. Le paiement se lit sur l'inscription, les autres
// points viennent de saison_readiness, alimentée par les événements des autres apps.

import { indicePreparation, type IndicePreparation, type StatutPoint } from "./regles"

export const POINTS_PREPARATION = ["paiement", "licences", "homologations", "papiers", "pieces"] as const
export type PointPreparation = (typeof POINTS_PREPARATION)[number]
export type EtatPoint = StatutPoint | "non_suivi"

export interface LigneReadiness {
  point: PointPreparation
  statut: StatutPoint
  detail: string | null
}

export interface PointEtabli {
  point: PointPreparation
  etat: EtatPoint
  detail: string | null
}

// Les cinq points, dans l'ordre d'affichage. Le paiement existe toujours ; les autres quand une ligne existe.
export function pointsDePreparation(paiementRegle: boolean, lignes: readonly LigneReadiness[]): PointEtabli[] {
  return POINTS_PREPARATION.map((point) => {
    if (point === "paiement") {
      return { point, etat: paiementRegle ? "regle" : "ouvert", detail: paiementRegle ? null : "Engagement non payé" }
    }
    const ligne = lignes.find((candidate) => candidate.point === point)
    if (!ligne) return { point, etat: "non_suivi", detail: null }
    return { point, etat: ligne.statut, detail: ligne.detail }
  })
}

// Indice de l'engagement : réglés ÷ points suivis. Aucun point suivi : pas d'indice.
export function indicePourEngagement(points: readonly PointEtabli[], maintenant: Date, debutEpreuve: Date): IndicePreparation | null {
  const suivis = points.filter((point): point is PointEtabli & { etat: StatutPoint } => point.etat !== "non_suivi")
  return indicePreparation(
    suivis.map((point) => ({ statut: point.etat })),
    maintenant,
    debutEpreuve,
  )
}

// Où régler un point ouvert, en un geste. Le paiement mène à la fiche engagement ; les autres,
// rien tant que leur app n'existe pas.
export function lieuDeReglage(point: PointPreparation): "fiche_engagement" | null {
  return point === "paiement" ? "fiche_engagement" : null
}
