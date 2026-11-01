// Lectures de Documents partagées avec Check-lists (tâche 5.7a, 956 §4). Lecture seule, sans garde : l'app appelante
// contrôle son propre accès. Seuls les documents actifs, visibles par toute la team, sont proposés : un document « gestion »
// ou « prive » ne doit pas apparaître, même par son titre, sur une liste de Check-lists.
import type { ObjetLieLu } from "@/apps/checklist/objets-types"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { objetDocument } from "./objets-checklist"

const SELECTION_OBJET = { id: true, title: true, validUntil: true } as const

export async function listerObjetsPourChecklist(ctx: ContexteTeam): Promise<ObjetLieLu[]> {
  const documents = await prismaPourTeam(ctx.teamId, ctx.userId).documentsDoc.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, status: "actif", visibility: "team" },
    select: SELECTION_OBJET,
    orderBy: { title: "asc" },
  })
  const maintenant = new Date()
  return documents.map((document) => objetDocument(document, maintenant))
}

// Un document, relu par son identifiant. Null s'il n'existe plus, s'il est archivé, ou s'il n'est plus visible par la team.
export async function lireObjetPourChecklist(ctx: ContexteTeam, id: string): Promise<ObjetLieLu | null> {
  const document = await prismaPourTeam(ctx.teamId, ctx.userId).documentsDoc.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null, status: "actif", visibility: "team" },
    select: SELECTION_OBJET,
  })
  return document ? objetDocument(document, new Date()) : null
}
