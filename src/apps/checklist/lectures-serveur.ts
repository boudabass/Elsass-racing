// Lectures de Check-lists (tâche 5.5a, brief §6). Une lecture n'écrit jamais. Chaque lecture passe par accesChecklist
// ('lecture') et filtre selon le rôle : l'assistance ne voit que les listes ouvertes à elle, n'accède à aucun modèle.
import { prismaPourTeam } from "@/lib/prisma"

import { listeVisiblePour, modelesVisiblesPour, pointsCritiquesOuverts, type PointRegle } from "./regles"
import { accesChecklist } from "./services-serveur"

// Listes d'une épreuve : communes d'abord, puis une par engagement. Avancement, zone, statut et critiques ouverts
// viennent des colonnes recalculées par le serveur (jamais saisies) et des points.
export async function listesDeEpreuve(epreuveId: string) {
  const { ctx } = await accesChecklist("lecture")
  const role = ctx.membership.role
  const listes = await prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findMany({
    where: { teamId: ctx.teamId, epreuveId, deletedAt: null },
    include: {
      sections: {
        where: { deletedAt: null },
        include: { items: { where: { deletedAt: null }, select: { statut: true, critique: true } } },
      },
    },
  })

  return listes
    .filter((liste) => listeVisiblePour(role, liste))
    .map((liste) => {
      const points: PointRegle[] = liste.sections.flatMap((section) => section.items)
      return {
        id: liste.id,
        titre: liste.titre,
        engagementId: liste.engagementId,
        vehiculeId: liste.vehiculeId,
        phase: liste.phase,
        echeance: liste.echeance,
        avancement: liste.avancement,
        zone: liste.zone,
        statut: liste.statut,
        ouverteAssistance: liste.ouverteAssistance,
        critiquesOuverts: pointsCritiquesOuverts(points).length,
      }
    })
    .sort((a, b) => Number(a.engagementId !== null) - Number(b.engagementId !== null) || a.titre.localeCompare(b.titre, "fr"))
}

// Une liste avec ses sections et ses points. Null si elle n'existe pas ou si ce rôle ne la voit pas.
export async function listeComplete(listeId: string) {
  const { ctx } = await accesChecklist("lecture")
  const liste = await prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findFirst({
    where: { id: listeId, teamId: ctx.teamId, deletedAt: null },
    include: {
      sections: {
        where: { deletedAt: null },
        orderBy: { ordre: "asc" },
        include: { items: { where: { deletedAt: null }, orderBy: { ordre: "asc" } } },
      },
    },
  })
  if (!liste || !listeVisiblePour(ctx.membership.role, liste)) return null
  return liste
}

// Historique des coches d'un point, le plus récent d'abord. Vide si le point n'est pas visible pour ce rôle.
export async function historiquePoint(pointId: string) {
  const { ctx } = await accesChecklist("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await client.checklistItem.findFirst({
    where: { id: pointId, teamId: ctx.teamId, deletedAt: null },
    include: { section: { include: { liste: { select: { ouverteAssistance: true } } } } },
  })
  if (!point || !listeVisiblePour(ctx.membership.role, point.section.liste)) return []
  return client.checklistCheckLog.findMany({
    where: { teamId: ctx.teamId, pointId },
    orderBy: [{ le: "desc" }, { id: "asc" }],
    select: { id: true, ancienStatut: true, nouveauStatut: true, parId: true, le: true, appareilId: true, horsLigne: true },
  })
}

// Modèles visibles : fournis par la plateforme et ceux de la team. Aucun pour l'assistance ni l'invité.
export async function modelesVisibles() {
  const { ctx } = await accesChecklist("lecture")
  if (!modelesVisiblesPour(ctx.membership.role)) return []
  return prismaPourTeam(ctx.teamId, ctx.userId).checklistTemplate.findMany({
    where: { deletedAt: null, OR: [{ fourni: true, teamId: null }, { teamId: ctx.teamId }] },
    orderBy: [{ fourni: "desc" }, { ordre: "asc" }, { nom: "asc" }],
    select: { id: true, nom: true, portee: true, phase: true, discipline: true, fourni: true, version: true },
  })
}

// Propositions en attente : réservées à la gestion, qui les accepte ou les ignore.
export async function propositionsEnAttente() {
  const { ctx, niveau } = await accesChecklist("lecture")
  if (niveau !== "gestion") return []
  return prismaPourTeam(ctx.teamId, ctx.userId).checklistProposal.findMany({
    where: { teamId: ctx.teamId, statut: "proposee", deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, contenu: true, actionId: true, createdAt: true },
  })
}
