// Données réelles de la team Koehling Racing : véhicule, pilotes, saison 2026, épreuves et
// engagements. Idempotent : chaque ligne est retrouvée par son nom avant d'être créée.
// Partagé entre pnpm donnees:koehling et les captures des tests de bout en bout.

import { randomUUID } from "node:crypto"

import type { PrismaClient } from "../../src/generated/prisma/client"

export const SLUG_KOEHLING = "koehling-racing-team"

const EPREUVES: Array<{
  nom: string
  type: "rallye" | "slalom"
  edition: number
  lieu: string
  departement: string
  debut: string
  fin: string
  statut: "terminee" | "envisagee"
  numero: string | null
  abandon?: string
}> = [
  { nom: "32e Rallye Régional de Printemps", type: "rallye", edition: 32, lieu: "Saint-Dié", departement: "88", debut: "2026-03-28", fin: "2026-03-29", statut: "terminee", numero: "87" },
  { nom: "2e Slalom de Juvaincourt", type: "slalom", edition: 2, lieu: "Juvaincourt", departement: "88", debut: "2026-05-13", fin: "2026-05-14", statut: "terminee", numero: "259" },
  { nom: "24e Rallye Ajolais", type: "rallye", edition: 24, lieu: "Le Val-d'Ajol", departement: "88", debut: "2026-05-22", fin: "2026-05-23", statut: "terminee", numero: "119" },
  { nom: "48e Rallye de la Plaine des Vosges", type: "rallye", edition: 48, lieu: "Mirecourt", departement: "88", debut: "2026-07-25", fin: "2026-07-26", statut: "terminee", numero: "137" },
  { nom: "41e Rallye du Florival", type: "rallye", edition: 41, lieu: "Rouffach", departement: "68", debut: "2026-08-07", fin: "2026-08-09", statut: "terminee", numero: "62" },
  { nom: "41e Rallye des Vallées", type: "rallye", edition: 41, lieu: "Remiremont", departement: "88", debut: "2026-08-21", fin: "2026-08-22", statut: "terminee", numero: "110" },
  { nom: "20e Rallye de l'Alsace Bossue", type: "rallye", edition: 20, lieu: "Alsace Bossue", departement: "67", debut: "2026-09-19", fin: "2026-09-20", statut: "terminee", numero: "130", abandon: "cardan" },
  { nom: "2e Slalom en côte du Gaschney", type: "slalom", edition: 2, lieu: "Muhlbach-sur-Munster", departement: "68", debut: "2026-10-10", fin: "2026-10-11", statut: "terminee", numero: null },
  { nom: "Super Slalom de l'Anneau du Rhin", type: "slalom", edition: 1, lieu: "Biltzheim", departement: "68", debut: "2026-11-11", fin: "2026-11-11", statut: "envisagee", numero: null },
]

// Écrit les données de la team donnée. Renvoie le nombre d'épreuves de la team, et celui créé
// à cet appel.
export async function appliquerDonneesKoehling(prisma: PrismaClient, teamId: string): Promise<{ epreuves: number; crees: number }> {
  // Véhicule
  let vehicule = await prisma.coreVehicle.findFirst({ where: { teamId, nomCourt: "Citroën Saxo VTS" } })
  if (!vehicule) {
    vehicule = await prisma.coreVehicle.create({
      data: { id: randomUUID(), teamId, type: "course", nomCourt: "Citroën Saxo VTS", actif: true },
    })
  }

  // Personnes (membres de l'équipe, sans compte lié)
  const personnes = [
    { nom: "Koehling", prenom: "Jeoffrey" },
    { nom: "Spiesser", prenom: "Aurélie" },
  ]
  const ids: Record<string, string> = {}
  for (const p of personnes) {
    let personne = await prisma.corePerson.findFirst({ where: { teamId, nom: p.nom, prenom: p.prenom } })
    if (!personne) {
      personne = await prisma.corePerson.create({
        data: { id: randomUUID(), teamId, nom: p.nom, prenom: p.prenom, membreTeam: true },
      })
    }
    ids[p.prenom] = personne.id
  }

  // Saison 2026
  let saison = await prisma.coreSeason.findFirst({ where: { teamId, annee: 2026 } })
  if (!saison) {
    saison = await prisma.coreSeason.create({
      data: {
        id: randomUUID(),
        teamId,
        annee: 2026,
        nom: "Saison 2026",
        dateDebut: new Date("2026-01-01"),
        dateFin: new Date("2026-12-31"),
        enCours: true,
      },
    })
  }

  // Épreuves et engagements
  let crees = 0
  for (const e of EPREUVES) {
    let evenement = await prisma.coreEvent.findFirst({ where: { teamId, nom: e.nom } })
    if (!evenement) {
      evenement = await prisma.coreEvent.create({
        data: {
          id: randomUUID(),
          teamId,
          seasonId: saison.id,
          type: e.type,
          nom: e.nom,
          edition: e.edition,
          dateDebut: new Date(e.debut),
          dateFin: new Date(e.fin),
          lieu: e.lieu,
          departement: e.departement,
          statut: e.statut,
        },
      })
      crees++
    }

    const engagement = await prisma.coreEventEntry.findFirst({
      where: { teamId, eventId: evenement.id, vehicleId: vehicule.id },
    })
    if (!engagement) {
      await prisma.coreEventEntry.create({
        data: {
          id: randomUUID(),
          teamId,
          eventId: evenement.id,
          vehicleId: vehicule.id,
          piloteId: ids["Jeoffrey"],
          copiloteId: ids["Aurélie"],
          numeroCourse: e.numero,
          groupe: "F-RC5",
          classe: "N2",
          statut: e.statut === "envisagee" ? "envisage" : e.abandon ? "abandon" : "arrivee",
          causeAbandon: e.abandon ?? null,
        },
      })
    }
  }

  await appliquerSaisonKoehling(prisma, teamId)

  const total = await prisma.coreEvent.count({ where: { teamId } })
  return { epreuves: total, crees }
}

// Saison (lot 2) : une fiche d'information par épreuve, une inscription par engagement, le point
// paiement ouvert pour les épreuves à venir, et pour la première épreuve passée trois spéciales et un
// résultat validé. ATTENTION : spéciales et résultat sont des DONNÉES DE TEST (noms génériques, aucun
// chrono réel). Ils sont à remplacer ou retirer avant tout usage réel de la team.
// Le résultat est écrit validé directement, sans preuve ni auteur : c'est un raccourci de test, le
// cycle de validation réel passe par les services. Idempotent : rien n'est modifié si la ligne existe.
async function appliquerSaisonKoehling(prisma: PrismaClient, teamId: string): Promise<void> {
  const epreuves = await prisma.coreEvent.findMany({
    where: { teamId, deletedAt: null },
    orderBy: { dateDebut: "asc" },
    select: { id: true, statut: true },
  })

  for (const epreuve of epreuves) {
    await prisma.saisonEventInfo.upsert({
      where: { eventId: epreuve.id },
      create: { id: randomUUID(), teamId, eventId: epreuve.id, devise: "EUR" },
      update: {},
    })
  }

  const engagements = await prisma.coreEventEntry.findMany({
    where: { teamId, deletedAt: null },
    select: { id: true, eventId: true, event: { select: { statut: true } } },
  })
  for (const engagement of engagements) {
    await prisma.saisonRegistration.upsert({
      where: { entryId: engagement.id },
      create: { id: randomUUID(), teamId, entryId: engagement.id, devise: "EUR" },
      update: {},
    })
    if (engagement.event.statut === "envisagee") {
      await prisma.saisonReadiness.upsert({
        where: { entryId_point: { entryId: engagement.id, point: "paiement" } },
        create: { id: randomUUID(), teamId, entryId: engagement.id, point: "paiement", statut: "ouvert", source: "saison" },
        update: {},
      })
    }
  }

  // Première épreuve passée : données de test (cf. commentaire ci-dessus).
  const premiere = epreuves.find((epreuve) => epreuve.statut === "terminee")
  if (!premiere) return
  const engagementPremiere = engagements.find((engagement) => engagement.eventId === premiere.id)
  if (!engagementPremiere) return

  for (const numero of [1, 2, 3]) {
    await prisma.saisonStage.upsert({
      where: { eventId_numero: { eventId: premiere.id, numero } },
      create: { id: randomUUID(), teamId, eventId: premiere.id, numero, nom: `Spéciale test ${numero}`, type: "speciale" },
      update: {},
    })
  }
  await prisma.saisonResult.upsert({
    where: { entryId: engagementPremiere.id },
    create: {
      id: randomUUID(),
      teamId,
      entryId: engagementPremiere.id,
      statutFinal: "arrivee",
      validation: "valide",
      valideLe: new Date(),
      public: true,
    },
    update: {},
  })
}
