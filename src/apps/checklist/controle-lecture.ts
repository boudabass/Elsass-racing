// Contrôle de lecture des photos de point de Check-lists (tâche 5.8, §3.1). Une photo se lit si son point appartient à une
// liste que le rôle voit : l'assistance ne voit que les listes ouvertes à elle (listeVisiblePour).
import type { ContexteTeam } from "@/core/contexte"
import type { ControleLecture } from "@/core/fichiers/controles-lecture"
import { prismaPourTeam } from "@/lib/prisma"

import { listeVisiblePour } from "./regles"

export async function pointLisible(ctx: ContexteTeam, pointId: string): Promise<boolean> {
  const point = await prismaPourTeam(ctx.teamId, ctx.userId).checklistItem.findFirst({
    where: { id: pointId, teamId: ctx.teamId, deletedAt: null },
    select: { section: { select: { liste: { select: { ouverteAssistance: true } } } } },
  })
  if (!point) return false
  return listeVisiblePour(ctx.membership.role, point.section.liste)
}

export const controleLectureChecklist: ControleLecture = {
  app: "checklist",
  ficheType: "point",
  peutLire: pointLisible,
}
