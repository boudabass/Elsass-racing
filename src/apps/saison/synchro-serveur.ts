// Déclarations de synchro de Saison (article 949, section 9 ; docs/synchro.md). Reçues hors ligne :
// core_event, saison_stage, saison_schedule_item, saison_recce (lecture seule). Écrites hors ligne :
// saison_recce_session et saison_debrief (contribution propre : on ne modifie que ses lignes).
// Le débrief reste privé à l'équipage : niveau de lecture « contribution », donc jamais l'assistance.
// Les règles de clôture et de sortie valent aussi ici : une saison clôturée n'accepte plus d'écriture.

import { z } from "zod"

import { emettre } from "@/core/evenements/bus-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { RefusSynchro } from "@/core/synchro/erreurs"
import { apresPosition } from "@/core/synchro/position"
import { refusLectureSeule, socleSynchro, type ClientTeam, type DeclarationSynchro, type EtatLigneSynchro, type Tx } from "@/core/synchro/registre"
import { prismaPourTeam } from "@/lib/prisma"

import { refusEcritureSaison } from "./regles-resultats"

const DATE_CIVILE = /^\d{4}-\d{2}-\d{2}$/

const schemaSortie = z
  .object({
    recceId: z.string().uuid(),
    date: z.string().regex(DATE_CIVILE, "Date de la sortie attendue."),
    personnes: z.array(z.string().uuid()).max(20),
    speciales: z.array(z.string().uuid()).max(50),
    passages: z.number().int().min(0).max(99).nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .strict()

const schemaDebrief = z
  .object({
    entryId: z.string().uuid(),
    ressenti: z.number().int().min(1, "Le ressenti va de 1 à 5.").max(5, "Le ressenti va de 1 à 5."),
    pointsPositifs: z.string().trim().max(2000).nullable(),
    pointsAAmeliorer: z.string().trim().max(2000).nullable(),
    problemesVoiture: z.string().trim().max(2000).nullable(),
  })
  .strict()

// Saison ouverte pour cette épreuve, lue dans la transaction (même règle que garderSaisonOuverte).
async function saisonOuverteTx(tx: Tx, teamId: string, eventId: string): Promise<void> {
  const epreuve = await tx.coreEvent.findFirst({
    where: { id: eventId, teamId },
    select: { season: { select: { clotureeAt: true } } },
  })
  const message = refusEcritureSaison(epreuve?.season.clotureeAt ?? null)
  if (message) throw new RefusSynchro(message)
}

// Les sorties sont rattachées à une reco de la team, qui cite des personnes et des spéciales de la team.
async function verifierSortieTx(tx: Tx, ctx: ContexteTeam, recceId: string, personnes: string[], speciales: string[]): Promise<string> {
  const recce = await tx.saisonRecce.findFirst({ where: { id: recceId, teamId: ctx.teamId, deletedAt: null }, select: { eventId: true } })
  if (!recce) throw new RefusSynchro("La reconnaissance de cette sortie n'existe pas dans cette team.")
  await saisonOuverteTx(tx, ctx.teamId, recce.eventId)
  const personnesUniques = Array.from(new Set(personnes))
  if (personnesUniques.length > 0) {
    const trouvees = await tx.corePerson.count({ where: { id: { in: personnesUniques }, teamId: ctx.teamId, deletedAt: null } })
    if (trouvees !== personnesUniques.length) throw new RefusSynchro("Une personne citée n'existe pas dans cette team.")
  }
  const specialesUniques = Array.from(new Set(speciales))
  if (specialesUniques.length > 0) {
    const trouvees = await tx.saisonStage.count({ where: { id: { in: specialesUniques }, eventId: recce.eventId, teamId: ctx.teamId, deletedAt: null } })
    if (trouvees !== specialesUniques.length) throw new RefusSynchro("Une spéciale citée n'appartient pas à cette épreuve.")
  }
  return recce.eventId
}

const coreEventSynchro: DeclarationSynchro = {
  cle: "core_event",
  ficheType: "epreuve",
  app: "saison",
  niveauLecture: "lecture",
  contributionPropre: false,
  lectureSeule: true,
  schemaChamps: z.object({}).strict(),

  async lirePaquet(client: ClientTeam, teamId, position, limite) {
    const lignes = await client.coreEvent.findMany({
      where: { teamId, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socleSynchro(l),
      nom: l.nom,
      type: l.type,
      lieu: l.lieu,
      statut: l.statut,
      dateDebut: l.dateDebut.toISOString().slice(0, 10),
      dateFin: l.dateFin.toISOString().slice(0, 10),
      seasonId: l.seasonId,
    }))
  },
  async trouver(tx: Tx, teamId, id): Promise<EtatLigneSynchro | null> {
    const ligne = await tx.coreEvent.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
  creer: refusLectureSeule,
  modifier: refusLectureSeule,
  supprimer: refusLectureSeule,
}

// Tables de l'épreuve, lues hors ligne : programme et spéciales, règles de reco.
function tableEpreuve(cle: string, ficheType: string, lirePaquet: DeclarationSynchro["lirePaquet"], trouver: DeclarationSynchro["trouver"]): DeclarationSynchro {
  return {
    cle,
    ficheType,
    app: "saison",
    niveauLecture: "lecture",
    contributionPropre: false,
    lectureSeule: true,
    schemaChamps: z.object({}).strict(),
    lirePaquet,
    trouver,
    creer: refusLectureSeule,
    modifier: refusLectureSeule,
    supprimer: refusLectureSeule,
  }
}

const saisonStageSynchro = tableEpreuve(
  "saison_stage",
  "speciale",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.saisonStage.findMany({
      where: { teamId, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socleSynchro(l),
      eventId: l.eventId,
      numero: l.numero,
      nom: l.nom,
      longueurKm: l.longueurKm?.toString() ?? null,
      nbPassages: l.nbPassages,
      type: l.type,
    }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.saisonStage.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

const saisonScheduleItemSynchro = tableEpreuve(
  "saison_schedule_item",
  "programme",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.saisonScheduleItem.findMany({
      where: { teamId, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socleSynchro(l),
      eventId: l.eventId,
      type: l.type,
      stageId: l.stageId,
      numeroPassage: l.numeroPassage,
      heurePrevue: l.heurePrevue?.toISOString() ?? null,
      lieu: l.lieu,
      entryId: l.entryId,
    }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.saisonScheduleItem.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

const saisonRecceSynchro = tableEpreuve(
  "saison_recce",
  "reconnaissance",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.saisonRecce.findMany({
      where: { teamId, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socleSynchro(l),
      eventId: l.eventId,
      debutAutorise: l.debutAutorise?.toISOString() ?? null,
      finAutorisee: l.finAutorisee?.toISOString() ?? null,
      passagesAutorises: l.passagesAutorises,
      vitesseMax: l.vitesseMax,
      vehiculeId: l.vehiculeId,
      plaqueRecue: l.plaqueRecue,
      consignes: l.consignes,
    }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.saisonRecce.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

// Sorties de reco : contribution propre, lisibles par l'assistance (lecture).
const saisonRecceSessionSynchro: DeclarationSynchro = {
  cle: "saison_recce_session",
  ficheType: "sortie_reco",
  app: "saison",
  niveauLecture: "lecture",
  contributionPropre: true,
  lectureSeule: false,
  schemaChamps: schemaSortie,

  async lirePaquet(client: ClientTeam, teamId, position, limite, auteurId) {
    const lignes = await client.saisonRecceSession.findMany({
      where: { teamId, ...(auteurId ? { createdBy: auteurId } : {}), ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socleSynchro(l),
      recceId: l.recceId,
      date: l.date.toISOString().slice(0, 10),
      personnes: l.personnes,
      speciales: l.speciales,
      passages: l.passages,
      notes: l.notes,
    }))
  },
  async trouver(tx: Tx, teamId, id): Promise<EtatLigneSynchro | null> {
    const ligne = await tx.saisonRecceSession.findFirst({ where: { id, teamId } })
    if (!ligne) return null
    return {
      rev: ligne.rev,
      auteurId: ligne.createdBy,
      supprimee: ligne.deletedAt !== null,
      contenu: { recceId: ligne.recceId, date: ligne.date.toISOString().slice(0, 10), personnes: ligne.personnes, speciales: ligne.speciales, passages: ligne.passages, notes: ligne.notes },
    }
  },
  async creer(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = schemaSortie.parse(champs)
    await verifierSortieTx(tx, ctx, donnees.recceId, donnees.personnes, donnees.speciales)
    await tx.saisonRecceSession.create({
      data: {
        id,
        teamId: ctx.teamId,
        recceId: donnees.recceId,
        date: new Date(`${donnees.date}T00:00:00Z`),
        personnes: donnees.personnes,
        speciales: donnees.speciales,
        passages: donnees.passages,
        notes: donnees.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  },
  async modifier(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = schemaSortie.parse(champs)
    const existante = await tx.saisonRecceSession.findFirst({ where: { id, teamId: ctx.teamId }, select: { recceId: true } })
    if (!existante) return false
    await verifierSortieTx(tx, ctx, existante.recceId, donnees.personnes, donnees.speciales)
    const resultat = await tx.saisonRecceSession.updateMany({
      where: { id, teamId: ctx.teamId },
      data: {
        date: new Date(`${donnees.date}T00:00:00Z`),
        personnes: donnees.personnes,
        speciales: donnees.speciales,
        passages: donnees.passages,
        notes: donnees.notes,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    return resultat.count > 0
  },
  async supprimer(tx: Tx, ctx: ContexteTeam, id) {
    const existante = await tx.saisonRecceSession.findFirst({ where: { id, teamId: ctx.teamId }, select: { recceId: true } })
    if (!existante) return false
    const recce = await tx.saisonRecce.findFirst({ where: { id: existante.recceId, teamId: ctx.teamId }, select: { eventId: true } })
    if (recce) await saisonOuverteTx(tx, ctx.teamId, recce.eventId)
    const resultat = await tx.saisonRecceSession.updateMany({
      where: { id, teamId: ctx.teamId },
      data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    return resultat.count > 0
  },
}

// Événement du débrief, émis une fois l'écriture validée (même événement qu'en ligne, saison.debrief_saisi).
async function emettreDebrief(ctx: ContexteTeam, id: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const debrief = await client.saisonDebrief.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    select: { entryId: true, auteurMembershipId: true },
  })
  if (!debrief) return
  const engagement = await client.coreEventEntry.findFirst({ where: { id: debrief.entryId, teamId: ctx.teamId }, select: { eventId: true } })
  if (!engagement) return
  await emettre(ctx, "saison.debrief_saisi", {
    entryId: debrief.entryId,
    eventId: engagement.eventId,
    auteurMembershipId: debrief.auteurMembershipId,
  })
}

// Débrief : privé à l'équipage. Un seul par engagement et par auteur ; niveau de lecture « contribution » :
// l'assistance (lecture) ne le reçoit jamais.
const saisonDebriefSynchro: DeclarationSynchro = {
  cle: "saison_debrief",
  ficheType: "debrief",
  app: "saison",
  niveauLecture: "contribution",
  contributionPropre: true,
  lectureSeule: false,
  schemaChamps: schemaDebrief,

  async lirePaquet(client: ClientTeam, teamId, position, limite, auteurId) {
    const lignes = await client.saisonDebrief.findMany({
      where: { teamId, ...(auteurId ? { createdBy: auteurId } : {}), ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socleSynchro(l),
      entryId: l.entryId,
      auteurMembershipId: l.auteurMembershipId,
      ressenti: l.ressenti,
      pointsPositifs: l.pointsPositifs,
      pointsAAmeliorer: l.pointsAAmeliorer,
      problemesVoiture: l.problemesVoiture,
    }))
  },
  async trouver(tx: Tx, teamId, id): Promise<EtatLigneSynchro | null> {
    const ligne = await tx.saisonDebrief.findFirst({ where: { id, teamId } })
    if (!ligne) return null
    return {
      rev: ligne.rev,
      auteurId: ligne.createdBy,
      supprimee: ligne.deletedAt !== null,
      contenu: { entryId: ligne.entryId, ressenti: ligne.ressenti, pointsPositifs: ligne.pointsPositifs, pointsAAmeliorer: ligne.pointsAAmeliorer, problemesVoiture: ligne.problemesVoiture },
    }
  },
  async creer(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = schemaDebrief.parse(champs)
    const engagement = await tx.coreEventEntry.findFirst({ where: { id: donnees.entryId, teamId: ctx.teamId }, select: { eventId: true } })
    if (!engagement) throw new RefusSynchro("Engagement introuvable dans cette team.")
    await saisonOuverteTx(tx, ctx.teamId, engagement.eventId)
    const deja = await tx.saisonDebrief.findFirst({
      where: { entryId: donnees.entryId, auteurMembershipId: ctx.membership.id, teamId: ctx.teamId },
      select: { id: true },
    })
    if (deja) throw new RefusSynchro("Tu as déjà un débrief pour cette épreuve.")
    await tx.saisonDebrief.create({
      data: {
        id,
        teamId: ctx.teamId,
        entryId: donnees.entryId,
        auteurMembershipId: ctx.membership.id,
        ressenti: donnees.ressenti,
        pointsPositifs: donnees.pointsPositifs,
        pointsAAmeliorer: donnees.pointsAAmeliorer,
        problemesVoiture: donnees.problemesVoiture,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  },
  async modifier(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = schemaDebrief.parse(champs)
    const existante = await tx.saisonDebrief.findFirst({ where: { id, teamId: ctx.teamId }, select: { entryId: true } })
    if (!existante) return false
    const engagement = await tx.coreEventEntry.findFirst({ where: { id: existante.entryId, teamId: ctx.teamId }, select: { eventId: true } })
    if (engagement) await saisonOuverteTx(tx, ctx.teamId, engagement.eventId)
    const resultat = await tx.saisonDebrief.updateMany({
      where: { id, teamId: ctx.teamId },
      data: {
        ressenti: donnees.ressenti,
        pointsPositifs: donnees.pointsPositifs,
        pointsAAmeliorer: donnees.pointsAAmeliorer,
        problemesVoiture: donnees.problemesVoiture,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    return resultat.count > 0
  },
  async supprimer(tx: Tx, ctx: ContexteTeam, id) {
    const resultat = await tx.saisonDebrief.updateMany({
      where: { id, teamId: ctx.teamId },
      data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    return resultat.count > 0
  },
  apresApplication: emettreDebrief,
}

export const declarationsSaisonSynchro: DeclarationSynchro[] = [
  coreEventSynchro,
  saisonStageSynchro,
  saisonScheduleItemSynchro,
  saisonRecceSynchro,
  saisonRecceSessionSynchro,
  saisonDebriefSynchro,
]

export const TABLES_SAISON_LECTURE_SEULE = ["core_event", "saison_stage", "saison_schedule_item", "saison_recce"] as const
