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

// Check-lists est-elle activée pour la team ? Sans elle, Saison ne montre pas l'avancement (5.7a).
export async function checklistActivee(ctx: ContexteTeam): Promise<boolean> {
  const activation = await prismaPourTeam(ctx.teamId, ctx.userId).coreTeamApp.findFirst({
    where: { teamId: ctx.teamId, appCle: "checklist", activee: true, deletedAt: null },
    select: { id: true },
  })
  return activation !== null
}

export type ResumeChecklistEngagement = ResumeChecklistEpreuve

// Avancement et points critiques ouverts des listes d'un engagement : ses listes, et les listes communes de son épreuve.
// Null s'il n'a aucune liste. Information seulement : Saison ne s'en sert jamais pour l'indice (5.7a, 956 §5).
export async function resumeChecklistEngagement(ctx: ContexteTeam, entryId: string): Promise<ResumeChecklistEngagement | null> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: entryId, teamId: ctx.teamId, deletedAt: null },
    select: { eventId: true },
  })
  if (!engagement) return null
  const listes = await client.checklistList.findMany({
    where: {
      teamId: ctx.teamId,
      epreuveId: engagement.eventId,
      deletedAt: null,
      OR: [{ engagementId: entryId }, { engagementId: null }],
    },
    select: {
      sections: {
        where: { deletedAt: null },
        select: { items: { where: { deletedAt: null }, select: { statut: true, critique: true } } },
      },
    },
  })
  if (listes.length === 0) return null
  const points: PointRegle[] = listes.flatMap((liste) => liste.sections.flatMap((section) => section.items))
  return {
    listes: listes.length,
    avancement: avancementPourcent(points),
    critiquesOuverts: pointsCritiquesOuverts(points).length,
  }
}
