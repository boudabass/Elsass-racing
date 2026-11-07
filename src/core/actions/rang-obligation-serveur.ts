// Engagements lus pour le rang bloquant (5.9) : ceux des personnes (pilote ou copilote) et ceux d'un véhicule, sur la fenêtre
// bloquante seulement. Lecture seule de core_event_entry et core_event. La règle reste dans rang-obligation.ts.

import type { Prisma } from "@/generated/prisma/client"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"
import { bornesFenetre, type EngagementPourRang, type StatutEngagementBloquant } from "./rang-obligation"

type Client = ReturnType<typeof prismaPourTeam>

// Engagements de chaque personne (pilote ou copilote), par identifiant de personne. Une personne sans engagement n'a pas d'entrée.
export async function engagementsDesPersonnes(
  client: Client,
  ctx: ContexteTeam,
  personIds: readonly string[],
  maintenant: Date,
): Promise<Map<string, EngagementPourRang[]>> {
  const parPersonne = new Map<string, EngagementPourRang[]>()
  if (personIds.length === 0) return parPersonne
  const personnes = new Set(personIds)
  const ids = Array.from(personnes)
  const entrees = await lireEntrees(client, ctx, { OR: [{ piloteId: { in: ids } }, { copiloteId: { in: ids } }] }, maintenant)
  for (const entree of entrees) {
    for (const personne of [entree.piloteId, entree.copiloteId]) {
      if (personne === null || !personnes.has(personne)) continue
      parPersonne.set(personne, [...(parPersonne.get(personne) ?? []), entree.engagement])
    }
  }
  return parPersonne
}

// Engagements d'un véhicule sur la fenêtre bloquante.
export async function engagementsDuVehicule(client: Client, ctx: ContexteTeam, vehicleId: string, maintenant: Date): Promise<EngagementPourRang[]> {
  const entrees = await lireEntrees(client, ctx, { vehicleId }, maintenant)
  return entrees.map((entree) => entree.engagement)
}

async function lireEntrees(
  client: Client,
  ctx: ContexteTeam,
  filtre: Prisma.CoreEventEntryWhereInput,
  maintenant: Date,
): Promise<Array<{ piloteId: string | null; copiloteId: string | null; engagement: EngagementPourRang }>> {
  const { debut, limite } = bornesFenetre(maintenant)
  const lignes = await client.coreEventEntry.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      ...filtre,
      event: { deletedAt: null, dateDebut: { lte: limite }, dateFin: { gte: debut } },
    },
    select: {
      piloteId: true,
      copiloteId: true,
      statut: true,
      event: { select: { id: true, dateDebut: true, dateFin: true, statut: true } },
    },
  })
  return lignes.map((ligne) => ({
    piloteId: ligne.piloteId,
    copiloteId: ligne.copiloteId,
    engagement: {
      eventId: ligne.event.id,
      dateDebut: ligne.event.dateDebut,
      dateFin: ligne.event.dateFin,
      annulee: ligne.event.statut === "annulee",
      statut: ligne.statut as StatutEngagementBloquant,
    },
  }))
}
