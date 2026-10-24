// Plan avant épreuve : lecture de l'écran, sous accesGarage("lecture") (tâche 4.5, §2). Les prix ne sortent qu'au
// niveau écriture ; l'assistance voit le plan sans coût.

import { aAuMoins } from "@/core/droits/niveaux"

import { lirePlanAvantEpreuve, type PlanAvantEpreuve } from "./lectures-partagees"
import { accesGarage } from "./services-serveur"

export async function lirePlanEcran(vehicleId: string, eventId: string | null): Promise<PlanAvantEpreuve | null> {
  const { ctx, niveau } = await accesGarage("lecture")
  return lirePlanAvantEpreuve(ctx, vehicleId, eventId, aAuMoins(niveau, "ecriture"))
}
