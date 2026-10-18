// Lectures de Saison partagées avec les autres apps (tâche 3.2, brief section 6). Ces fonctions ne font
// pas de garde : l'app appelante contrôle son propre accès. Elles ne renvoient que des données de
// résultat, jamais les fiches d'écriture de Saison. Voiture s'en sert pour l'historique du véhicule.

import type { ContexteTeam } from "@/core/contexte"
import type { Prisma } from "@/generated/prisma/client"
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

// Lectures pour la page partenaire (brief 3.7, §3) : elles prennent le client de la transaction publique, sans
// contexte d'utilisateur. Une seule team, et seulement les saisons données par l'appelant (celles des conventions
// du partenaire). Lecture seule : rien ici n'expose les fiches d'écriture de Saison.

export type EpreuvePourPartenaire = {
  nom: string
  dateDebut: Date
  dateFin: Date
  lieu: string | null
  saison: string
}

// Calendrier des épreuves de ces saisons : nom, dates, lieu. Rien d'autre (ni engagement, ni montants, ni membres).
export async function listerCalendrierPourPartenaires(
  client: Pick<Prisma.TransactionClient, "coreEvent">,
  teamId: string,
  saisonIds: string[],
): Promise<EpreuvePourPartenaire[]> {
  if (saisonIds.length === 0) return []
  const epreuves = await client.coreEvent.findMany({
    where: { teamId, seasonId: { in: saisonIds }, deletedAt: null },
    select: { nom: true, dateDebut: true, dateFin: true, lieu: true, season: { select: { nom: true } } },
    orderBy: { dateDebut: "asc" },
  })
  return epreuves.map((e) => ({ nom: e.nom, dateDebut: e.dateDebut, dateFin: e.dateFin, lieu: e.lieu, saison: e.season.nom }))
}

export type ResultatPublicPourPartenaire = {
  epreuve: string
  dateDebut: Date
  statutFinal: "arrivee" | "abandon" | "exclusion" | "forfait"
  classementGeneral: number | null
  nbClasses: number | null
  classementClasse: number | null
  nbPartantsClasse: number | null
}

// Résultats validés ET marqués publics par la team, des épreuves de ces saisons. Un résultat masqué n'apparaît pas.
export async function listerResultatsPublicsPourPartenaires(
  client: Pick<Prisma.TransactionClient, "saisonResult">,
  teamId: string,
  saisonIds: string[],
): Promise<ResultatPublicPourPartenaire[]> {
  if (saisonIds.length === 0) return []
  const resultats = await client.saisonResult.findMany({
    where: { teamId, deletedAt: null, public: true, validation: "valide", entry: { event: { seasonId: { in: saisonIds } } } },
    select: {
      statutFinal: true,
      classementGeneral: true,
      nbClasses: true,
      classementClasse: true,
      nbPartantsClasse: true,
      entry: { select: { event: { select: { nom: true, dateDebut: true } } } },
    },
    orderBy: { entry: { event: { dateDebut: "desc" } } },
  })
  return resultats.map((r) => ({
    epreuve: r.entry.event.nom,
    dateDebut: r.entry.event.dateDebut,
    statutFinal: r.statutFinal,
    classementGeneral: r.classementGeneral,
    nbClasses: r.nbClasses,
    classementClasse: r.classementClasse,
    nbPartantsClasse: r.nbPartantsClasse,
  }))
}
