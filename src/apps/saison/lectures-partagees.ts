// Lectures de Saison partagées avec les autres apps (tâche 3.2, brief section 6). Ces fonctions ne font
// pas de garde : l'app appelante contrôle son propre accès. Elles ne renvoient que des données de
// résultat, jamais les fiches d'écriture de Saison. Voiture s'en sert pour l'historique du véhicule.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

export type ResultatValideVehicule = {
  entryId: string
  eventId: string
  epreuveNom: string
  dateDebut: Date
  statutFinal: "arrivee" | "abandon" | "exclusion" | "forfait"
  classementGeneral: number | null
  nbClasses: number | null
  classementClasse: number | null
  nbPartantsClasse: number | null
  // Kilomètres de spéciale : longueur × passages (1 si vide), pour une arrivée dans une épreuve terminée.
  kmSpeciale: number
}

// Résultats validés d'un véhicule, du plus récent au plus ancien. Seuls les résultats au statut « valide »
// comptent : un résultat saisi ou contesté n'apparaît pas.
export async function lireResultatsValidesParVehicule(ctx: ContexteTeam, vehicleId: string): Promise<ResultatValideVehicule[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagements = await client.coreEventEntry.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null, saisonResult: { validation: "valide" } },
    select: {
      id: true,
      eventId: true,
      event: { select: { nom: true, dateDebut: true, statut: true } },
      saisonResult: {
        select: {
          statutFinal: true,
          classementGeneral: true,
          nbClasses: true,
          classementClasse: true,
          nbPartantsClasse: true,
        },
      },
    },
    orderBy: { event: { dateDebut: "desc" } },
  })

  // Une seule requête pour les spéciales de toutes les épreuves concernées.
  const epreuvesTerminees = engagements
    .filter((e) => e.saisonResult?.statutFinal === "arrivee" && e.event.statut === "terminee")
    .map((e) => e.eventId)
  const speciales = epreuvesTerminees.length
    ? await client.saisonStage.findMany({
        where: { teamId: ctx.teamId, eventId: { in: epreuvesTerminees }, type: "speciale", deletedAt: null },
        select: { eventId: true, longueurKm: true, nbPassages: true },
      })
    : []

  const kmParEpreuve = new Map<string, number>()
  for (const special of speciales) {
    const km = Number(special.longueurKm ?? 0) * (special.nbPassages ?? 1)
    kmParEpreuve.set(special.eventId, (kmParEpreuve.get(special.eventId) ?? 0) + km)
  }

  return engagements.flatMap((e) => {
    if (!e.saisonResult) return []
    const terminee = e.saisonResult.statutFinal === "arrivee" && e.event.statut === "terminee"
    return [
      {
        entryId: e.id,
        eventId: e.eventId,
        epreuveNom: e.event.nom,
        dateDebut: e.event.dateDebut,
        statutFinal: e.saisonResult.statutFinal,
        classementGeneral: e.saisonResult.classementGeneral,
        nbClasses: e.saisonResult.nbClasses,
        classementClasse: e.saisonResult.classementClasse,
        nbPartantsClasse: e.saisonResult.nbPartantsClasse,
        kmSpeciale: terminee ? (kmParEpreuve.get(e.eventId) ?? 0) : 0,
      },
    ]
  })
}
