// Règle de contribution : au niveau contribution, on n'écrit que ses propres lignes (celles dont
// created_by est le compte courant). Au-dessus, on écrit toutes les lignes de la table.

import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

export type VerdictEcriture = { ok: true } | { ok: false; raison: string }

// Périmètre de lecture d'une table pour un membre : aucun (la table n'est pas renvoyée), ses seules
// lignes (niveau contribution : « on ne voit que ce qu'on a créé », article 948), ou toute la team.
export type PerimetreLecture = "aucun" | "ses_lignes" | "toute_la_team"

export function perimetreLecture(niveau: Niveau, lectureRequise: Niveau): PerimetreLecture {
  if (!aAuMoins(niveau, lectureRequise)) return "aucun"
  if (niveau === "contribution") return "ses_lignes"
  return "toute_la_team"
}

export interface ParametresEcriture {
  niveau: Niveau
  contributionPropre: boolean
  // Auteur de la ligne visée (created_by). Vide pour une création : c'est l'auteur qui sera posé.
  auteurId: string | null
  userId: string
  creation: boolean
}

export function peutEcrire({ niveau, contributionPropre, auteurId, userId, creation }: ParametresEcriture): VerdictEcriture {
  if (!aAuMoins(niveau, "contribution")) {
    return { ok: false, raison: "Tu n'as pas le droit d'écrire ici." }
  }
  if (creation || !contributionPropre || niveau !== "contribution") return { ok: true }
  if (auteurId !== userId) return { ok: false, raison: "Tu ne peux modifier que tes propres éléments." }
  return { ok: true }
}
