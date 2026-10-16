// Services serveur de Saison. Chaque fonction publique passe par exigerAcces("saison", niveau)
// et ne reçoit jamais la team ni le compte de l'appelant : ils viennent de la garde.
// Les fonctions « …Dans(ctx, …) » font le travail sans garde : elles servent aux vérifications
// de bus (scripts/verifier-bus.ts) et ne doivent pas être appelées depuis un composant.
//
// Écritures : rev incrémenté, updatedBy posé. Montants : cf. masquerMontants (règles pures).
// Aucun nom d'événement hors du catalogue (src/core/evenements/catalogue.ts).

import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { exigerAcces } from "@/core/droits/garde-serveur"
import type { Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import {
  causeAbandonEngagement,
  masquerMontants,
  prochaineEpreuve,
  statutEngagement,
  statutEpreuve,
  transitionResultat,
  type EntreeStatut,
  type StatutEngagement,
  type StatutEpreuve,
  type StatutResultat,
  type ValidationResultat,
} from "./regles"

// --- Accès --------------------------------------------------------------------------------

async function accesSaison(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("saison", requis)
  return {
    ctx: { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } },
    niveau,
  }
}

function refus(message: string): never {
  throw new Error(message)
}

// Dates calendaires saisies « AAAA-MM-JJ », stockées à minuit UTC (cf. @db.Date).
const dateCivile = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")
  .transform((texte) => new Date(`${texte}T00:00:00Z`))

const TYPES_EPREUVE = ["rallye", "slalom", "course_de_cote", "expo", "roulage", "autre"] as const

function formaterJour(date: Date): string {
  return date.toLocaleDateString("fr-FR", { timeZone: "UTC" })
}

// --- Épreuves -----------------------------------------------------------------------------

const schemaEpreuve = z
  .object({
    nom: z.string().trim().min(1, "Le nom de l'épreuve est vide.").max(200, "Le nom dépasse 200 caractères."),
    dateDebut: dateCivile,
    dateFin: dateCivile,
    type: z.enum(TYPES_EPREUVE),
  })
  .strict()
  .refine((epreuve) => epreuve.dateFin >= epreuve.dateDebut, {
    message: "La date de fin précède la date de début.",
    path: ["dateFin"],
  })

export type EntreeEpreuve = z.input<typeof schemaEpreuve>

export async function creerEpreuve(entree: EntreeEpreuve): Promise<string> {
  const { ctx } = await accesSaison("ecriture")
  return creerEpreuveDans(ctx, entree)
}

export async function creerEpreuveDans(ctx: ContexteTeam, entree: EntreeEpreuve): Promise<string> {
  const donnees = schemaEpreuve.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const saison = await client.coreSeason.findFirst({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      clotureeAt: null,
      dateDebut: { lte: donnees.dateDebut },
      dateFin: { gte: donnees.dateFin },
    },
    select: { id: true },
  })
  if (!saison) {
    refus(
      `Aucune saison ouverte ne couvre les dates du ${formaterJour(donnees.dateDebut)} au ${formaterJour(donnees.dateFin)}. Crée la saison, ou vérifie les dates.`,
    )
  }

  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.coreEvent.create({
      data: {
        id,
        teamId: ctx.teamId,
        seasonId: saison.id,
        type: donnees.type,
        nom: donnees.nom,
        dateDebut: donnees.dateDebut,
        dateFin: donnees.dateFin,
        statut: "envisagee",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await tx.saisonEventInfo.create({
      data: { id: newId(), teamId: ctx.teamId, eventId: id, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
  })

  await recalculerDans(ctx)
  return id
}

const schemaModificationEpreuve = z
  .object({
    nom: z.string().trim().min(1, "Le nom de l'épreuve est vide.").max(200).optional(),
    dateDebut: dateCivile.optional(),
    dateFin: dateCivile.optional(),
    type: z.enum(TYPES_EPREUVE).optional(),
  })
  .strict()

export type EntreeModificationEpreuve = z.input<typeof schemaModificationEpreuve>

export async function modifierEpreuve(eventId: string, entree: EntreeModificationEpreuve): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return modifierEpreuveDans(ctx, eventId, entree)
}

export async function modifierEpreuveDans(ctx: ContexteTeam, eventId: string, entree: EntreeModificationEpreuve): Promise<void> {
  const modif = schemaModificationEpreuve.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const epreuve = await client.coreEvent.findFirst({
    where: { id: eventId, teamId: ctx.teamId, deletedAt: null },
    include: { season: { select: { dateDebut: true, dateFin: true, clotureeAt: true } } },
  })
  if (!epreuve) refus("Épreuve introuvable dans cette team.")
  if (epreuve.season.clotureeAt) refus("La saison de cette épreuve est clôturée.")

  const dateDebut = modif.dateDebut ?? epreuve.dateDebut
  const dateFin = modif.dateFin ?? epreuve.dateFin
  if (dateFin < dateDebut) refus("La date de fin précède la date de début.")
  if (dateDebut < epreuve.season.dateDebut || dateFin > epreuve.season.dateFin) {
    refus("Les dates sortent de la saison de cette épreuve.")
  }

  await client.coreEvent.updateMany({
    where: { id: eventId, teamId: ctx.teamId },
    data: {
      nom: modif.nom ?? epreuve.nom,
      type: modif.type ?? epreuve.type,
      dateDebut,
      dateFin,
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })
  await recalculerDans(ctx)
}

export async function annulerEpreuve(eventId: string): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return annulerEpreuveDans(ctx, eventId)
}

export async function annulerEpreuveDans(ctx: ContexteTeam, eventId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({ where: { id: eventId, teamId: ctx.teamId, deletedAt: null } })
  if (!epreuve) refus("Épreuve introuvable dans cette team.")
  if (epreuve.statut === "terminee") refus("Une épreuve terminée ne s'annule pas.")

  await client.coreEvent.updateMany({
    where: { id: eventId, teamId: ctx.teamId },
    data: { statut: "annulee", rev: { increment: 1 }, updatedBy: ctx.userId },
  })
  await recalculerDans(ctx)
}

// --- Engagements --------------------------------------------------------------------------

const schemaEngagement = z
  .object({
    eventId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    piloteId: z.string().uuid().nullable().optional(),
    copiloteId: z.string().uuid().nullable().optional(),
  })
  .strict()

export type EntreeEngagement = z.input<typeof schemaEngagement>

export async function creerEngagement(entree: EntreeEngagement): Promise<string> {
  const { ctx } = await accesSaison("ecriture")
  return creerEngagementDans(ctx, entree)
}

export async function creerEngagementDans(ctx: ContexteTeam, entree: EntreeEngagement): Promise<string> {
  const donnees = schemaEngagement.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const epreuve = await client.coreEvent.findFirst({ where: { id: donnees.eventId, teamId: ctx.teamId, deletedAt: null } })
  if (!epreuve) refus("Épreuve introuvable dans cette team.")
  if (epreuve.statut === "annulee") refus("Cette épreuve est annulée : on ne s'y engage pas.")

  const vehicule = await client.coreVehicle.findFirst({ where: { id: donnees.vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!vehicule) refus("Véhicule introuvable dans cette team.")

  for (const personneId of [donnees.piloteId, donnees.copiloteId]) {
    if (!personneId) continue
    const personne = await client.corePerson.findFirst({ where: { id: personneId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!personne) refus("Personne introuvable dans cette team.")
  }

  const doublon = await client.coreEventEntry.findFirst({
    where: { teamId: ctx.teamId, eventId: donnees.eventId, vehicleId: donnees.vehicleId, deletedAt: null },
    select: { id: true },
  })
  if (doublon) refus("Ce véhicule est déjà engagé sur cette épreuve.")

  const entryId = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.coreEventEntry.create({
      data: {
        id: entryId,
        teamId: ctx.teamId,
        eventId: donnees.eventId,
        vehicleId: donnees.vehicleId,
        piloteId: donnees.piloteId ?? null,
        copiloteId: donnees.copiloteId ?? null,
        statut: "envisage",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await tx.saisonRegistration.create({
      data: { id: newId(), teamId: ctx.teamId, entryId, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
    await tx.saisonReadiness.create({
      data: {
        id: newId(),
        teamId: ctx.teamId,
        entryId,
        point: "paiement",
        statut: "ouvert",
        source: "saison",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  })

  await emettre(ctx, "saison.engagement_cree", { entryId, eventId: donnees.eventId, vehicleId: donnees.vehicleId })
  await recalculerDans(ctx)
  return entryId
}

const schemaPaiement = z
  .object({
    payeLe: dateCivile,
    mode: z.enum(["cheque", "virement", "en_ligne"]),
    payeurPersonId: z.string().uuid().nullable().optional(),
    montant: z.number().int("Le montant est en centimes entiers.").min(0, "Le montant ne peut pas être négatif."),
    devise: z.string().length(3).default("EUR"),
  })
  .strict()

export type EntreePaiement = z.input<typeof schemaPaiement>

export async function enregistrerPaiement(entryId: string, entree: EntreePaiement): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return enregistrerPaiementDans(ctx, entryId, entree)
}

export async function enregistrerPaiementDans(ctx: ContexteTeam, entryId: string, entree: EntreePaiement): Promise<void> {
  const donnees = schemaPaiement.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const inscription = await client.saisonRegistration.findFirst({ where: { entryId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!inscription) refus("Inscription introuvable pour cet engagement.")
  const engagement = await client.coreEventEntry.findFirst({ where: { id: entryId, teamId: ctx.teamId, deletedAt: null }, select: { eventId: true } })
  if (!engagement) refus("Engagement introuvable dans cette team.")

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.saisonRegistration.updateMany({
      where: { entryId, teamId: ctx.teamId },
      data: {
        payeLe: donnees.payeLe,
        modePaiement: donnees.mode,
        payeurPersonId: donnees.payeurPersonId ?? null,
        montantPaye: donnees.montant,
        devise: donnees.devise,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    await tx.saisonReadiness.updateMany({
      where: { entryId, teamId: ctx.teamId, point: "paiement" },
      data: { statut: "regle", rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })

  await synchroniserEntree(ctx, entryId)
  await emettre(ctx, "saison.engagement_paye", {
    entryId,
    eventId: engagement.eventId,
    montant_paye: donnees.montant,
    devise: donnees.devise,
    payeurPersonId: donnees.payeurPersonId ?? null,
  })
  await recalculerDans(ctx)
}

// --- Lecture -----------------------------------------------------------------------------

// Inscription d'un engagement, montants retirés quand le niveau effectif est « lecture ».
export async function lireInscription(entryId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const inscription = await prismaPourTeam(ctx.teamId, ctx.userId).saisonRegistration.findFirst({
    where: { entryId, teamId: ctx.teamId, deletedAt: null },
  })
  return inscription ? masquerMontants(inscription, niveau) : null
}

// --- Résultats ----------------------------------------------------------------------------

const schemaResultat = z
  .object({
    statutFinal: z.enum(["arrivee", "abandon", "exclusion", "forfait"]),
    causeAbandon: z.string().trim().max(300).nullable().optional(),
    stageAbandonId: z.string().uuid().nullable().optional(),
    classementGeneral: z.number().int().positive().nullable().optional(),
    nbClasses: z.number().int().positive().nullable().optional(),
    classementGroupe: z.number().int().positive().nullable().optional(),
    classementClasse: z.number().int().positive().nullable().optional(),
    nbPartantsClasse: z.number().int().positive().nullable().optional(),
    tempsTotalMs: z.number().int().min(0).nullable().optional(),
    penalitesMs: z.number().int().min(0).nullable().optional(),
    kmChronometres: z.number().min(0).max(9999.9).nullable().optional(),
    public: z.boolean().optional(),
  })
  .strict()

export type EntreeResultat = z.input<typeof schemaResultat>

// Saisit ou corrige le résultat. Un résultat validé ne se corrige pas : il faut le contester.
export async function saisirResultat(entryId: string, entree: EntreeResultat): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return saisirResultatDans(ctx, entryId, entree)
}

export async function saisirResultatDans(ctx: ContexteTeam, entryId: string, entree: EntreeResultat): Promise<void> {
  const donnees = schemaResultat.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const engagement = await client.coreEventEntry.findFirst({ where: { id: entryId, teamId: ctx.teamId, deletedAt: null }, select: { id: true, eventId: true } })
  if (!engagement) refus("Engagement introuvable dans cette team.")

  if (donnees.stageAbandonId) {
    const stage = await client.saisonStage.findFirst({
      where: { id: donnees.stageAbandonId, eventId: engagement.eventId, teamId: ctx.teamId, deletedAt: null },
      select: { id: true },
    })
    if (!stage) refus("La spéciale d'abandon n'appartient pas à cette épreuve.")
  }

  const existant = await client.saisonResult.findFirst({ where: { entryId, teamId: ctx.teamId, deletedAt: null } })
  if (existant?.validation === "valide") refus("Ce résultat est validé : conteste-le pour le modifier.")
  // Corriger un résultat contesté le repasse à vérifier : la preuve doit être revue.
  const validation = existant?.validation === "conteste" ? "a_verifier" : existant?.validation ?? "saisi"

  const champs = {
    statutFinal: donnees.statutFinal,
    causeAbandon: donnees.causeAbandon ?? null,
    stageAbandonId: donnees.stageAbandonId ?? null,
    classementGeneral: donnees.classementGeneral ?? null,
    nbClasses: donnees.nbClasses ?? null,
    classementGroupe: donnees.classementGroupe ?? null,
    classementClasse: donnees.classementClasse ?? null,
    nbPartantsClasse: donnees.nbPartantsClasse ?? null,
    tempsTotalMs: donnees.tempsTotalMs ?? null,
    penalitesMs: donnees.penalitesMs ?? null,
    kmChronometres: donnees.kmChronometres ?? null,
    public: donnees.public ?? true,
  }

  if (existant) {
    await client.saisonResult.updateMany({
      where: { id: existant.id, teamId: ctx.teamId },
      data: { ...champs, validation, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  } else {
    await client.saisonResult.create({
      data: {
        id: newId(),
        teamId: ctx.teamId,
        entryId,
        ...champs,
        validation: "saisi",
        saisiParMembershipId: ctx.membership.id,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  }

  await synchroniserEntree(ctx, entryId)
}

// Joint une preuve (lien ou fichier) : le résultat passe à vérifier.
export async function joindrePreuve(entryId: string, preuve: { preuveLien?: string | null; preuveFileId?: string | null }): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return joindrePreuveDans(ctx, entryId, preuve)
}

export async function joindrePreuveDans(
  ctx: ContexteTeam,
  entryId: string,
  preuve: { preuveLien?: string | null; preuveFileId?: string | null },
): Promise<void> {
  const lien = preuve.preuveLien?.trim() || null
  const fichierId = preuve.preuveFileId ?? null
  if (!lien && !fichierId) refus("Une preuve est attendue : un lien ou un fichier.")
  if (lien && lien.length > 500) refus("Le lien dépasse 500 caractères.")

  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const resultat = await client.saisonResult.findFirst({ where: { entryId, teamId: ctx.teamId, deletedAt: null } })
  if (!resultat) refus("Saisis d'abord le résultat de cet engagement.")

  if (fichierId) {
    const fichier = await client.coreFile.findFirst({ where: { id: fichierId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!fichier) refus("Fichier introuvable dans cette team.")
  }

  const transition = transitionResultat(
    { validation: resultat.validation, saisiParMembershipId: resultat.saisiParMembershipId },
    { type: "joindre_preuve" },
    { membershipId: ctx.membership.id, role: ctx.membership.role },
  )
  if (!transition.ok) refus(transition.message)

  await client.saisonResult.updateMany({
    where: { id: resultat.id, teamId: ctx.teamId },
    data: {
      validation: transition.validation,
      preuveLien: lien ?? resultat.preuveLien,
      preuveFileId: fichierId ?? resultat.preuveFileId,
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })
  await synchroniserEntree(ctx, entryId)
}

export async function validerResultat(entryId: string): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return validerResultatDans(ctx, entryId)
}

export async function validerResultatDans(ctx: ContexteTeam, entryId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const resultat = await client.saisonResult.findFirst({ where: { entryId, teamId: ctx.teamId, deletedAt: null } })
  if (!resultat) refus("Aucun résultat à valider pour cet engagement.")

  const transition = transitionResultat(
    { validation: resultat.validation, saisiParMembershipId: resultat.saisiParMembershipId },
    { type: "valider" },
    { membershipId: ctx.membership.id, role: ctx.membership.role },
  )
  if (!transition.ok) refus(transition.message)

  await client.saisonResult.updateMany({
    where: { id: resultat.id, teamId: ctx.teamId },
    data: {
      validation: "valide",
      valideLe: new Date(),
      validParMembershipId: ctx.membership.id,
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })
  await synchroniserEntree(ctx, entryId)

  const engagement = await client.coreEventEntry.findFirst({ where: { id: entryId, teamId: ctx.teamId }, select: { eventId: true } })
  const eventId = engagement?.eventId ?? null
  await emettre(ctx, "saison.resultat_valide", {
    entryId,
    eventId,
    statutFinal: resultat.statutFinal,
    classementGeneral: resultat.classementGeneral,
    tempsTotalMs: resultat.tempsTotalMs,
    penalitesMs: resultat.penalitesMs,
  })
  if (resultat.statutFinal === "abandon") {
    await emettre(ctx, "saison.abandon_declare", {
      entryId,
      eventId,
      causeAbandon: resultat.causeAbandon,
      stageAbandonId: resultat.stageAbandonId,
    })
  }
  await recalculerDans(ctx)
}

export async function contesterResultat(entryId: string, commentaire: string): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return contesterResultatDans(ctx, entryId, commentaire)
}

export async function contesterResultatDans(ctx: ContexteTeam, entryId: string, commentaire: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const resultat = await client.saisonResult.findFirst({ where: { entryId, teamId: ctx.teamId, deletedAt: null } })
  if (!resultat) refus("Aucun résultat à contester pour cet engagement.")

  const transition = transitionResultat(
    { validation: resultat.validation, saisiParMembershipId: resultat.saisiParMembershipId },
    { type: "contester", commentaire },
    { membershipId: ctx.membership.id, role: ctx.membership.role },
  )
  if (!transition.ok) refus(transition.message)

  await client.saisonResult.updateMany({
    where: { id: resultat.id, teamId: ctx.teamId },
    data: {
      validation: transition.validation,
      commentaireContestation: commentaire.trim(),
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })
  await synchroniserEntree(ctx, entryId)

  // Le résultat quitte le statut validé : les abonnés doivent le savoir.
  const engagement = await client.coreEventEntry.findFirst({ where: { id: entryId, teamId: ctx.teamId }, select: { eventId: true } })
  await emettre(ctx, "saison.resultat_annule", { entryId, eventId: engagement?.eventId ?? null })
  await recalculerDans(ctx)
}

// --- Débriefs -----------------------------------------------------------------------------

const schemaDebrief = z
  .object({
    ressenti: z.number().int().min(1, "Le ressenti va de 1 à 5.").max(5, "Le ressenti va de 1 à 5."),
    pointsPositifs: z.string().trim().max(2000).nullable().optional(),
    pointsAAmeliorer: z.string().trim().max(2000).nullable().optional(),
    problemesVoiture: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()

export type EntreeDebrief = z.input<typeof schemaDebrief>

// Un débrief par membre et par engagement : celui de l'appelant est créé ou mis à jour.
export async function saisirDebrief(entryId: string, entree: EntreeDebrief): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return saisirDebriefDans(ctx, entryId, entree)
}

export async function saisirDebriefDans(ctx: ContexteTeam, entryId: string, entree: EntreeDebrief): Promise<void> {
  const donnees = schemaDebrief.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const engagement = await client.coreEventEntry.findFirst({ where: { id: entryId, teamId: ctx.teamId, deletedAt: null }, select: { eventId: true } })
  if (!engagement) refus("Engagement introuvable dans cette team.")

  const champs = {
    ressenti: donnees.ressenti,
    pointsPositifs: donnees.pointsPositifs ?? null,
    pointsAAmeliorer: donnees.pointsAAmeliorer ?? null,
    problemesVoiture: donnees.problemesVoiture ?? null,
  }
  const existant = await client.saisonDebrief.findFirst({
    where: { entryId, auteurMembershipId: ctx.membership.id, teamId: ctx.teamId, deletedAt: null },
  })
  if (existant) {
    await client.saisonDebrief.updateMany({
      where: { id: existant.id, teamId: ctx.teamId },
      data: { ...champs, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  } else {
    await client.saisonDebrief.create({
      data: {
        id: newId(),
        teamId: ctx.teamId,
        entryId,
        auteurMembershipId: ctx.membership.id,
        ...champs,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  }

  await emettre(ctx, "saison.debrief_saisi", {
    entryId,
    eventId: engagement.eventId,
    auteurMembershipId: ctx.membership.id,
  })
}

// --- Saisons ------------------------------------------------------------------------------

export async function creerSaison(annee: number): Promise<string> {
  const { ctx } = await accesSaison("gestion")
  return creerSaisonDans(ctx, annee)
}

export async function creerSaisonDans(ctx: ContexteTeam, annee: number): Promise<string> {
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) refus("Année de saison invalide.")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const existante = await client.coreSeason.findFirst({ where: { teamId: ctx.teamId, annee }, select: { id: true } })
  if (existante) refus(`La saison ${annee} existe déjà.`)

  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    // Une seule saison en cours : l'ancienne n'a plus ce statut.
    await tx.coreSeason.updateMany({ where: { teamId: ctx.teamId, enCours: true }, data: { enCours: false, updatedBy: ctx.userId, rev: { increment: 1 } } })
    await tx.coreSeason.create({
      data: {
        id,
        teamId: ctx.teamId,
        annee,
        nom: `Saison ${annee}`,
        dateDebut: new Date(Date.UTC(annee, 0, 1)),
        dateFin: new Date(Date.UTC(annee, 11, 31)),
        enCours: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  })

  await emettre(ctx, "saison.saison_creee", { seasonId: id, annee })
  await recalculerDans(ctx)
  return id
}

export async function cloturerSaison(seasonId: string): Promise<void> {
  const { ctx } = await accesSaison("gestion")
  return cloturerSaisonDans(ctx, seasonId)
}

// Clôture manuelle. clotureProposee (règles pures) indique quand la proposer ; elle ne bloque pas.
export async function cloturerSaisonDans(ctx: ContexteTeam, seasonId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const saison = await client.coreSeason.findFirst({ where: { id: seasonId, teamId: ctx.teamId, deletedAt: null, clotureeAt: null } })
  if (!saison) refus("Saison introuvable ou déjà clôturée.")

  await client.coreSeason.updateMany({
    where: { id: seasonId, teamId: ctx.teamId },
    data: { clotureeAt: new Date(), enCours: false, rev: { increment: 1 }, updatedBy: ctx.userId },
  })
  await emettre(ctx, "saison.saison_cloturee", { seasonId, annee: saison.annee })
}

// --- Recalcul : statuts d'épreuves et d'engagements, prochaine épreuve --------------------

// Applique les règles 2.1 et 2.2 aux épreuves de la saison en cours. Appelée à l'ouverture du
// QG (chargerQg) et après chaque écriture de Saison. Pas de worker au lot 2.
export async function recalculerEpreuves(): Promise<void> {
  const { ctx } = await accesSaison("lecture")
  return recalculerDans(ctx)
}

export async function recalculerDans(ctx: ContexteTeam): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const maintenant = new Date()

  const saison = await client.coreSeason.findFirst({
    where: { teamId: ctx.teamId, enCours: true, deletedAt: null, clotureeAt: null },
    select: { id: true },
  })
  if (!saison) return

  const epreuves = await client.coreEvent.findMany({
    where: { teamId: ctx.teamId, seasonId: saison.id, deletedAt: null },
    select: { id: true, statut: true, dateDebut: true, dateFin: true, entries: { where: { deletedAt: null }, select: { id: true } } },
    orderBy: [{ dateDebut: "asc" }, { id: "asc" }],
  })

  const calculees: Array<{ id: string; statut: StatutEpreuve; dateDebut: Date; dateFin: Date; engagements: StatutEngagement[] }> = []
  for (const epreuve of epreuves) {
    const statut = statutEpreuve({ statut: epreuve.statut, dateDebut: epreuve.dateDebut, dateFin: epreuve.dateFin }, maintenant)
    if (statut !== epreuve.statut) {
      await client.coreEvent.updateMany({
        where: { id: epreuve.id, teamId: ctx.teamId },
        data: { statut, rev: { increment: 1 }, updatedBy: ctx.userId },
      })
      // Passage à terminée : une seule fois par épreuve, car le statut persisté ne revient pas en arrière.
      if (statut === "terminee") {
        await emettre(ctx, "saison.epreuve_terminee", { eventId: epreuve.id, seasonId: saison.id })
      }
    }

    const engagements: StatutEngagement[] = []
    for (const entree of epreuve.entries) {
      engagements.push(await synchroniserEntree(ctx, entree.id))
    }
    calculees.push({ id: epreuve.id, statut, dateDebut: epreuve.dateDebut, dateFin: epreuve.dateFin, engagements })
  }

  // La prochaine épreuve se compare à celle du dernier événement émis : pas d'état à part.
  const prochaine = prochaineEpreuve(calculees, maintenant)
  const derniere = await client.coreDomainEvent.findFirst({
    where: { teamId: ctx.teamId, nom: "saison.prochaine_epreuve_modifiee" },
    orderBy: { createdAt: "desc" },
    select: { donnees: true },
  })
  const precedente = (derniere?.donnees as { eventId?: string | null } | null | undefined)?.eventId ?? null
  const actuelle = prochaine?.id ?? null
  if (precedente !== actuelle) {
    await emettre(ctx, "saison.prochaine_epreuve_modifiee", { eventId: actuelle, seasonId: saison.id })
  }
}

// Recalcule le statut d'un engagement à partir de son inscription et de son résultat, et l'écrit
// s'il a changé. Renvoie le statut courant. Le kilométrage et la cause d'abandon de l'engagement
// suivent le résultat validé (ils sont vides sans résultat validé).
async function synchroniserEntree(ctx: ContexteTeam, entryId: string): Promise<StatutEngagement> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: entryId, teamId: ctx.teamId, deletedAt: null },
    include: { event: { select: { dateDebut: true } }, saisonRegistration: true, saisonResult: true },
  })
  if (!engagement) refus("Engagement introuvable dans cette team.")

  const reg = engagement.saisonRegistration
  const res = engagement.saisonResult
  const entreeStatut: EntreeStatut = {
    dossierEnvoyeLe: reg?.dossierEnvoyeLe ?? null,
    payeLe: reg?.payeLe ?? null,
    dateDebutEpreuve: engagement.event.dateDebut,
    resultat: res ? { statutFinal: res.statutFinal as StatutResultat, validation: res.validation as ValidationResultat } : null,
  }
  const statut = statutEngagement(entreeStatut, new Date())
  const valide = res?.validation === "valide"
  const kmVoulu = valide ? res.kmChronometres : null
  const causeVoulue = valide && res ? causeAbandonEngagement({ statutFinal: res.statutFinal as StatutResultat, causeAbandon: res.causeAbandon }) : null

  const kmActuel = engagement.kmChronometres?.toString() ?? null
  const kmSouhaite = kmVoulu?.toString() ?? null
  if (statut !== engagement.statut || kmActuel !== kmSouhaite || engagement.causeAbandon !== causeVoulue) {
    await client.coreEventEntry.updateMany({
      where: { id: entryId, teamId: ctx.teamId },
      data: { statut, kmChronometres: kmVoulu, causeAbandon: causeVoulue, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  }
  return statut
}
