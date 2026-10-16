// Lectures des écrans de Saison. Toutes passent par accesSaison (niveau lecture au moins) et
// renvoient le niveau effectif : l'écran s'en sert pour n'afficher aucun bouton d'écriture.
// Les montants (inscription, tarifs) passent par masquerMontants : jamais un simple masquage CSS.

import { prismaPourTeam } from "@/lib/prisma"
import type { Niveau } from "@/core/droits/niveaux"

import { masquerMontants } from "./regles"
import { accesSaison } from "./services-serveur"

export async function lireAcces(): Promise<{ niveau: Niveau }> {
  const { niveau } = await accesSaison("lecture")
  return { niveau }
}

export async function listerSaisons() {
  const { ctx, niveau } = await accesSaison("lecture")
  const saisons = await prismaPourTeam(ctx.teamId, ctx.userId).coreSeason.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    orderBy: { annee: "desc" },
    select: { id: true, annee: true, nom: true, enCours: true, clotureeAt: true },
  })
  return { niveau, saisons }
}

// Épreuves d'une saison, avec leurs engagements (statut et validation du résultat) pour « Reste à faire ».
export async function listerEpreuves(seasonId: string | null) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuves = await client.coreEvent.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, ...(seasonId ? { seasonId } : {}) },
    orderBy: [{ dateDebut: "asc" }, { id: "asc" }],
    select: {
      id: true,
      nom: true,
      type: true,
      lieu: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      seasonId: true,
      entries: {
        where: { deletedAt: null },
        select: { statut: true, saisonResult: { select: { validation: true } } },
      },
    },
  })
  return {
    niveau,
    epreuves: epreuves.map((epreuve) => ({
      ...epreuve,
      engagements: epreuve.entries.map((entree) => ({
        statut: entree.statut,
        resultat: entree.saisonResult?.validation ?? null,
      })),
      entries: undefined,
    })),
  }
}

// Fiche d'une épreuve : infos (tarifs masqués sous lecture), spéciales, programme, engagements.
export async function lireEpreuve(eventId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({
    where: { id: eventId, teamId: ctx.teamId, deletedAt: null },
    include: {
      saisonInfo: true,
      saisonStages: { where: { deletedAt: null }, orderBy: { numero: "asc" } },
      saisonScheduleItems: { where: { deletedAt: null }, orderBy: { heurePrevue: "asc" } },
      entries: {
        where: { deletedAt: null },
        include: { vehicle: { select: { nomCourt: true } }, pilote: { select: { prenom: true, nom: true } }, copilote: { select: { prenom: true, nom: true } } },
        orderBy: { createdAt: "asc" },
      },
      season: { select: { annee: true, nom: true, clotureeAt: true } },
    },
  })
  if (!epreuve) return null

  const kmSpeciales = epreuve.saisonStages.reduce((total, stage) => total + Number(stage.longueurKm ?? 0) * (stage.nbPassages ?? 1), 0)
  return {
    niveau,
    epreuve: {
      id: epreuve.id,
      nom: epreuve.nom,
      type: epreuve.type,
      lieu: epreuve.lieu,
      departement: epreuve.departement,
      lienOfficiel: epreuve.lienOfficiel,
      statut: epreuve.statut,
      dateDebut: epreuve.dateDebut,
      dateFin: epreuve.dateFin,
      saison: epreuve.season,
    },
    infos: epreuve.saisonInfo ? masquerMontants(epreuve.saisonInfo, niveau) : null,
    speciales: epreuve.saisonStages,
    programme: epreuve.saisonScheduleItems,
    kmChronometresTotal: Math.round(kmSpeciales * 10) / 10,
    engagements: epreuve.entries.map((entree) => ({
      id: entree.id,
      statut: entree.statut,
      numeroCourse: entree.numeroCourse,
      groupe: entree.groupe,
      classe: entree.classe,
      voiture: entree.vehicle.nomCourt,
      pilote: entree.pilote ? `${entree.pilote.prenom} ${entree.pilote.nom}` : null,
      copilote: entree.copilote ? `${entree.copilote.prenom} ${entree.copilote.nom}` : null,
    })),
  }
}

// Fiche d'un engagement : voiture, équipage, fiche et inscription (montants masqués sous lecture).
export async function lireEngagement(entryId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: entryId, teamId: ctx.teamId, deletedAt: null },
    include: {
      event: { select: { id: true, nom: true, dateDebut: true, statut: true } },
      vehicle: { select: { nomCourt: true } },
      pilote: { select: { prenom: true, nom: true } },
      copilote: { select: { prenom: true, nom: true } },
      saisonRegistration: true,
    },
  })
  if (!engagement) return null

  return {
    niveau,
    engagement: {
      id: engagement.id,
      statut: engagement.statut,
      numeroCourse: engagement.numeroCourse,
      groupe: engagement.groupe,
      classe: engagement.classe,
      voiture: engagement.vehicle.nomCourt,
      pilote: engagement.pilote ? `${engagement.pilote.prenom} ${engagement.pilote.nom}` : null,
      copilote: engagement.copilote ? `${engagement.copilote.prenom} ${engagement.copilote.nom}` : null,
      epreuve: engagement.event,
    },
    inscription: engagement.saisonRegistration ? masquerMontants(engagement.saisonRegistration, niveau) : null,
  }
}

// Voitures de course actives et personnes de la team, pour les listes de l'engagement.
export async function listerChoixEngagement() {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [voitures, personnes] = await Promise.all([
    client.coreVehicle.findMany({
      where: { teamId: ctx.teamId, deletedAt: null, actif: true, type: "course" },
      select: { id: true, nomCourt: true },
      orderBy: { nomCourt: "asc" },
    }),
    client.corePerson.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      select: { id: true, prenom: true, nom: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
  ])
  return { niveau, voitures, personnes }
}
