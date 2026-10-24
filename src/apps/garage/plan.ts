// Plan avant épreuve (tâche 4.5, 954 v1.4 §2 et §4). Constat seul : rien ici ne propose un achat, un remplacement
// ni un ordre. Règles pures, sans accès base.

import { etatPiece, zoneDeEtat, type DureesVie, type ModeUsure, type SaisieEtat, type Seuils, type Usure, type Zone } from "./regles"

// État estimé après l'épreuve (décision de l'orchestrateur, 24/10) : même calcul que l'état actuel, avec les km de
// spéciale prévus et une épreuve de plus. Une estimation n'existe que si elle peut être faite honnêtement.
export type EstimationApres =
  | { statut: "estimee"; etat: number; zone: Zone }
  // Organe qui compte en km, et longueurs des spéciales non saisies : rien à estimer.
  | { statut: "sans_km" }
  // Durée de vie manquante : l'état n'est déjà pas connu aujourd'hui.
  | { statut: "a_renseigner" }
  // Pas de pièce montée : aucun état à projeter.
  | { statut: "sans_piece" }
  // Organe Pneus : l'usure est saisie à la main, rien à projeter.
  | { statut: "pneus" }

export function estimationApresEpreuve(entree: {
  mode: ModeUsure
  durees: DureesVie
  usure: Usure
  saisie: SaisieEtat | null
  seuils: Seuils
  kmPrevus: number | null
}): EstimationApres {
  const { mode, durees, usure, saisie, seuils, kmPrevus } = entree
  if (etatPiece(mode, durees, usure, saisie) === null) return { statut: "a_renseigner" }
  // En mode épreuves seul, les km ne comptent pas : l'estimation existe sans longueur de spéciale.
  if (mode !== "epreuves" && kmPrevus === null) return { statut: "sans_km" }
  const apres = etatPiece(mode, durees, { km: usure.km + (kmPrevus ?? 0), epreuves: usure.epreuves + 1 }, saisie)
  if (apres === null) return { statut: "a_renseigner" }
  return { statut: "estimee", etat: apres, zone: zoneDeEtat(apres, seuils) }
}

// Décompte des zones d'un plan : les organes « À renseigner » sont comptés à part, sans couleur.
export type DecompteZones = { rouge: number; surveiller: number; vert: number; aRenseigner: number }

export function compterZones(zones: Zone[]): DecompteZones {
  const decompte: DecompteZones = { rouge: 0, surveiller: 0, vert: 0, aRenseigner: 0 }
  for (const zone of zones) {
    if (zone === "rouge") decompte.rouge += 1
    else if (zone === "orange") decompte.surveiller += 1
    else if (zone === "vert") decompte.vert += 1
    else decompte.aRenseigner += 1
  }
  return decompte
}

// Durée et coût des ordres prévus pour l'épreuve. Le coût reste null hors niveau écriture (l'assistance n'en voit pas).
export function totalPrevus(
  ordres: Array<{ dureeEstimeeMinutes: number | null; coutMainOeuvreCents: number | null }>,
  avecPrix: boolean,
): { dureeMinutes: number; coutCents: number | null } {
  const dureeMinutes = ordres.reduce((total, ordre) => total + (ordre.dureeEstimeeMinutes ?? 0), 0)
  if (!avecPrix) return { dureeMinutes, coutCents: null }
  return { dureeMinutes, coutCents: ordres.reduce((total, ordre) => total + (ordre.coutMainOeuvreCents ?? 0), 0) }
}
