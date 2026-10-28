// Point Papiers de Saison, lu chez Voiture (tâche 5.2b, brief §1-2). Lecture seule : Saison n'écrit rien chez Voiture.
// Sans Voiture activée pour la team, les engagements n'ont pas ce point (null).

import { lireNomsCourtsVehicules, lirePapiersVehicules, voitureActivee } from "@/apps/voiture/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"

import { pointPapiersDeVehicule, type PointVoiture } from "./preparation"

export interface EngagementAPreparerVehicule {
  id: string
  vehicleId: string
}

// Par engagement : le point Papiers du véhicule à la date de l'épreuve, ou null si Voiture n'est pas activée.
export async function lirePointsVoiture(
  ctx: ContexteTeam,
  engagements: readonly EngagementAPreparerVehicule[],
  dateEpreuve: Date,
): Promise<Map<string, PointVoiture | null>> {
  const resultat = new Map<string, PointVoiture | null>()
  if (!(await voitureActivee(ctx))) {
    for (const engagement of engagements) resultat.set(engagement.id, null)
    return resultat
  }

  const vehicleIds = engagements.map((engagement) => engagement.vehicleId)
  const papiers = await lirePapiersVehicules(ctx, vehicleIds)
  const noms = await lireNomsCourtsVehicules(ctx, vehicleIds)
  for (const engagement of engagements) {
    const nom = noms.get(engagement.vehicleId) ?? null
    resultat.set(engagement.id, pointPapiersDeVehicule(engagement.vehicleId, nom, papiers.get(engagement.vehicleId) ?? [], dateEpreuve))
  }
  return resultat
}
