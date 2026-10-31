// Lecture partagée de Check-lists pour Saison (tâche 5.5a, brief §6) : avancement global et points critiques ouverts
// d'une épreuve. Lecture seule, sans garde propre : l'appelant (Saison) contrôle son droit. Le panneau de Saison ne la
// branche pas encore : c'est la 5.7. Les points ne sont lus que par team, jamais une autre.
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { avancementPourcent, pointsCritiquesOuverts, type PointRegle } from "./regles"

export interface ResumeChecklistEpreuve {
  listes: number
  avancement: number
  critiquesOuverts: number
}

export async function resumeChecklistEpreuve(ctx: ContexteTeam, epreuveId: string): Promise<ResumeChecklistEpreuve> {
  const listes = await prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findMany({
    where: { teamId: ctx.teamId, epreuveId, deletedAt: null },
    select: {
      sections: {
        where: { deletedAt: null },
        select: { items: { where: { deletedAt: null }, select: { statut: true, critique: true } } },
      },
    },
  })
  const points: PointRegle[] = listes.flatMap((liste) => liste.sections.flatMap((section) => section.items))
  return {
    listes: listes.length,
    avancement: avancementPourcent(points),
    critiquesOuverts: pointsCritiquesOuverts(points).length,
  }
}
