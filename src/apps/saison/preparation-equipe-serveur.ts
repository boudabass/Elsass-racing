// Points licences et homologations de Saison, lus chez Équipe (tâche 5.2, brief §0.2). Lecture seule : Saison
// n'écrit rien chez Équipe. Sans Équipe activée pour la team, les engagements n'ont pas ces points (null).

import { equipeActivee, lireSituationsPersonnes } from "@/apps/equipe/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"

import { pointsEquipeDeEngagement, type PointsEquipe } from "./preparation"

export interface EngagementAPreparer {
  id: string
  piloteId: string | null
  copiloteId: string | null
}

// Par engagement : ses points Équipe à la date de l'épreuve, ou null si Équipe n'est pas activée.
export async function lirePointsEquipe(
  ctx: ContexteTeam,
  engagements: readonly EngagementAPreparer[],
  dateEpreuve: Date,
): Promise<Map<string, PointsEquipe | null>> {
  const resultat = new Map<string, PointsEquipe | null>()
  if (!(await equipeActivee(ctx))) {
    for (const engagement of engagements) resultat.set(engagement.id, null)
    return resultat
  }

  const personnes = engagements.flatMap((engagement) => [engagement.piloteId, engagement.copiloteId])
  const situations = await lireSituationsPersonnes(ctx, personnes.filter((id): id is string => id !== null))
  for (const engagement of engagements) {
    resultat.set(
      engagement.id,
      pointsEquipeDeEngagement(
        {
          pilote: engagement.piloteId ? (situations.get(engagement.piloteId) ?? null) : null,
          copilote: engagement.copiloteId ? (situations.get(engagement.copiloteId) ?? null) : null,
        },
        dateEpreuve,
      ),
    )
  }
  return resultat
}
