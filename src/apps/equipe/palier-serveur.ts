// Épreuves qui comptent pour le palier d'une personne (955 §4) : son équipage validé, plus son assistance (affectée
// ET « vient »). Partagé par la liaison de palier (liaisons-serveur.ts) et par la fiche (lectures-serveur.ts), sans
// gestionnaire enregistré à l'import.

import { lireEpreuvesEquipageValidees } from "@/apps/saison/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { epreuvesAssistanceIds, epreuvesDuPalier } from "./regles"

// Épreuves d'assistance : affectée ET « vient ». Le palier compte les épreuves, jamais les classements.
export async function epreuvesAssistanceDe(ctx: ContexteTeam, personId: string): Promise<string[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const affectations = await client.equipeAssignment.findMany({ where: { teamId: ctx.teamId, personId, deletedAt: null }, select: { eventId: true } })
  const venues = await client.equipeAvailability.findMany({
    where: { teamId: ctx.teamId, personId, reponse: "vient", deletedAt: null },
    select: { eventId: true },
  })
  return epreuvesAssistanceIds(
    affectations.map((affectation) => affectation.eventId),
    venues.map((venue) => venue.eventId),
  )
}

// Nombre d'épreuves du palier : équipage validé ∪ assistance, sans doublon.
export async function nombreEpreuvesDePalier(ctx: ContexteTeam, personId: string): Promise<number> {
  const equipage = await lireEpreuvesEquipageValidees(ctx, personId)
  const assistance = await epreuvesAssistanceDe(ctx, personId)
  return epreuvesDuPalier(equipage, assistance)
}
