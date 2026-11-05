// Proposition d'ordre et décision pour un problème signalé dans Check-lists (tâche 5.7a). Garage ouvre l'ordre lui-même, à
// l'acceptation ; il n'écrit jamais dans Check-lists. La lecture de l'organe passe par sa propre lecture partagée.
import { PRIORITE } from "@/core/actions/priorites"
import { rouvrirAction } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { emettre } from "@/core/evenements/bus-serveur"
import { ErreurMetier } from "@/core/sdk/actions-serveur"
import { prismaPourTeam } from "@/lib/prisma"

import { cleOrdreDePoint } from "@/apps/checklist/objets-lies"

import { BOUTONS_ORDRE_DEPUIS_POINT, titreProbleme } from "./ordre-depuis-point"
import { lireObjetPourChecklist } from "./lectures-partagees"
import { creerOrdreDans } from "./services-serveur"

export interface ProblemePourOrdre {
  pointId: string
  epreuveId: string
  listeTitre: string | null
  lienId: string
}

// Propose l'ordre : une action « Ouvrir l'ordre » ou « Ignorer » pour les responsables. Rien n'est créé avant l'acceptation.
// Un organe qui n'existe plus n'a rien à proposer.
export async function proposerOrdreDepuisPointDans(ctx: ContexteTeam, probleme: ProblemePourOrdre): Promise<void> {
  const organe = await lireObjetPourChecklist(ctx, "organe_garage", probleme.lienId)
  if (!organe) return
  await emettre(ctx, "garage.action_requise", {
    type: "ordre_depuis_point",
    cleUnicite: cleOrdreDePoint(probleme.pointId),
    titre: titreProbleme(organe.libelle),
    ...(probleme.listeTitre ? { contexte: `Liste : ${probleme.listeTitre}` } : {}),
    ficheType: "organe",
    ficheId: probleme.lienId,
    eventId: probleme.epreuveId,
    destinataires: { roles: ["responsable"] },
    boutons: BOUTONS_ORDRE_DEPUIS_POINT.map((bouton) => ({ ...bouton })),
    priorite: PRIORITE.proposition,
    niveauRequis: "ecriture",
    cleRegroupement: "problemes_checklist",
  })
}

// Accepter ouvre un ordre de réparation sur l'organe ; Ignorer ne fait rien. Un refus métier (organe disparu) rouvre l'action
// avec son motif, sans planter.
export async function appliquerDecisionOrdre(ctx: ContexteTeam, decision: { cleUnicite: string; decision: string; ficheId: string }): Promise<void> {
  if (decision.decision !== "accepter") return
  try {
    const organe = await lireObjetPourChecklist(ctx, "organe_garage", decision.ficheId)
    if (!organe || organe.vehicleId === null) throw new ErreurMetier("Cet organe n'existe plus : l'ordre ne peut pas être ouvert.")
    await creerOrdreDans(ctx, organe.vehicleId, { type: "reparation", titre: titreProbleme(organe.libelle), vehicleComponentId: decision.ficheId })
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur
    await rouvrirAction(prismaPourTeam(ctx.teamId, ctx.userId), ctx, decision.cleUnicite, erreur.message)
  }
}
