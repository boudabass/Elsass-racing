// Origine des fichiers de Documents pour « Tous les fichiers » (tâche 5.4). Une version est visible si son document l'est
// (peutVoirDocument, la même règle que le coffre). Le libellé est le titre du document.
import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import type { FicheOrigine, OrigineFichier } from "@/core/fichiers/types-origine"
import { prismaPourTeam } from "@/lib/prisma"

import { peutVoirDocument, type QuiAgit } from "./regles"

async function personneDuMembre(ctx: ContexteTeam): Promise<string | null> {
  const membre = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findFirst({
    where: { id: ctx.membership.id, teamId: ctx.teamId, deletedAt: null },
    select: { personId: true },
  })
  return membre?.personId ?? null
}

export const origineVersionsDocuments: OrigineFichier = {
  app: "documents",
  ficheType: "documents_version",

  async fichesVisibles(ctx, ids) {
    if (ids.length === 0) return []
    const niveau = await niveauDe(ctx, "documents")
    if (niveau === "aucun") return []
    const client = prismaPourTeam(ctx.teamId, ctx.userId)
    const versions = await client.documentsVersion.findMany({
      where: { teamId: ctx.teamId, id: { in: [...ids] }, deletedAt: null },
      select: { id: true, docId: true },
    })
    const docIds = Array.from(new Set(versions.map((version) => version.docId)))
    const documents = await client.documentsDoc.findMany({
      where: { teamId: ctx.teamId, id: { in: docIds }, deletedAt: null },
      select: {
        id: true,
        title: true,
        ownerPersonId: true,
        visibility: true,
        folder: { select: { ownerPersonId: true, visibility: true } },
      },
    })
    const personneId = await personneDuMembre(ctx)
    const acces = personneId
      ? await client.documentsAccess.findMany({
          where: { teamId: ctx.teamId, personId: personneId, docId: { in: docIds }, deletedAt: null },
          select: { docId: true, level: true },
        })
      : []
    const qui: QuiAgit = { personId: personneId, niveau }

    const fiches: FicheOrigine[] = []
    for (const version of versions) {
      const document = documents.find((doc) => doc.id === version.docId)
      if (!document) continue
      const accesPersonne = acces.find((a) => a.docId === document.id)?.level ?? null
      const visible = peutVoirDocument(
        { ownerPersonId: document.ownerPersonId, visibility: document.visibility, accesPersonne },
        document.folder,
        qui,
      )
      if (visible) fiches.push({ id: version.id, libelle: document.title, chemin: `/apps/documents/document/${document.id}` })
    }
    return fiches
  },
}
