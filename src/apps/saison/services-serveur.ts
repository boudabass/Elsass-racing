// Services serveur de Saison. Chaque fonction publique passe par exigerAcces("saison", niveau)
// et ne reçoit jamais la team ni le compte de l'appelant : ils viennent de la garde.
// Les fonctions « …Dans(ctx, …) » font le travail sans garde : elles servent aux vérifications
// de bus (scripts/verifier-bus.ts) et ne doivent pas être appelées depuis un composant.
//
// Écritures : rev incrémenté, updatedBy posé. Montants : cf. masquerMontants (règles pures).
// Aucun nom d'événement hors du catalogue (src/core/evenements/catalogue.ts).

import { z } from "zod"

import type { Prisma } from "@/generated/prisma/client"
import type { EpreuvePourCloture } from "./regles"
import { enregistrerGestionnaire } from "@/core/evenements/gestionnaires"

import type { ContexteTeam } from "@/core/contexte"
import { exigerAcces } from "@/core/droits/garde-serveur"
import type { Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import {
  causeAbandonEngagement,
  clotureProposee,
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
import {
  PRIORITE_CLOTURE_PROPOSEE,
  PRIORITE_RESULTAT_A_VALIDER,
  refusEcritureSaison,
} from "./regles-resultats"

// --- Accès --------------------------------------------------------------------------------

export async function accesSaison(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("saison", requis)
  return {
    ctx: { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } },
    niveau,
  }
}

// Refus métier : le message est en français et s'affiche tel quel à l'utilisateur.
export class ErreurSaison extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErreurSaison"
  }
}

function refus(message: string): never {
  throw new ErreurSaison(message)
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
  await garderSaisonOuverte(ctx, { eventId })
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
  await garderSaisonOuverte(ctx, { eventId })
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
  await garderSaisonOuverte(ctx, { eventId: donnees.eventId })
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
  await garderSaisonOuverte(ctx, { entryId })
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
  await garderSaisonOuverte(ctx, { entryId })
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
  await demanderValidation(ctx, entryId)
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
  await garderSaisonOuverte(ctx, { entryId })
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
  await demanderValidation(ctx, entryId)
}

export async function validerResultat(entryId: string): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return validerResultatDans(ctx, entryId)
}

export async function validerResultatDans(ctx: ContexteTeam, entryId: string): Promise<void> {
  await garderSaisonOuverte(ctx, { entryId })
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
  await lever(ctx, entryId)
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
  await garderSaisonOuverte(ctx, { entryId })
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

  await lever(ctx, entryId)
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
  await garderSaisonOuverte(ctx, { entryId })
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

export async function creerSaison(annee: number, dates?: { debut: string; fin: string }): Promise<string> {
  const { ctx } = await accesSaison("gestion")
  return creerSaisonDans(ctx, annee, dates)
}

export async function creerSaisonDans(ctx: ContexteTeam, annee: number, dates?: { debut: string; fin: string }): Promise<string> {
  const debut = dates ? new Date(`${dates.debut}T00:00:00Z`) : new Date(Date.UTC(annee, 0, 1))
  const fin = dates ? new Date(`${dates.fin}T00:00:00Z`) : new Date(Date.UTC(annee, 11, 31))
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || fin < debut) refus("Les dates de la saison sont invalides : la fin doit suivre le début.")
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
        dateDebut: debut,
        dateFin: fin,
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

  // Une seule lecture : épreuves, engagements, inscriptions et résultats. Seules les lignes qui
  // changent sont écrites, si bien qu'une ouverture du QG sans changement ne fait que lire.
  const epreuves = await client.coreEvent.findMany({
    where: { teamId: ctx.teamId, seasonId: saison.id, deletedAt: null },
    select: {
      id: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      entries: {
        where: { deletedAt: null },
        select: {
          id: true,
          statut: true,
          kmChronometres: true,
          causeAbandon: true,
          saisonRegistration: { select: { dossierEnvoyeLe: true, payeLe: true } },
          saisonResult: { select: { statutFinal: true, validation: true, kmChronometres: true, causeAbandon: true } },
        },
      },
    },
    orderBy: [{ dateDebut: "asc" }, { id: "asc" }],
  })

  const calculees: Array<{ id: string; statut: StatutEpreuve; dateDebut: Date; dateFin: Date; engagements: StatutEngagement[] }> = []
  const pourCloture: EpreuvePourCloture[] = []
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
      const cible = calculerEngagement(entree, epreuve.dateDebut, maintenant)
      if (cible.statut !== entree.statut || cible.km !== (entree.kmChronometres?.toString() ?? null) || cible.cause !== entree.causeAbandon) {
        await client.coreEventEntry.updateMany({
          where: { id: entree.id, teamId: ctx.teamId },
          data: { statut: cible.statut, kmChronometres: cible.kmDecimal, causeAbandon: cible.cause, rev: { increment: 1 }, updatedBy: ctx.userId },
        })
      }
      engagements.push(cible.statut)
    }
    calculees.push({ id: epreuve.id, statut, dateDebut: epreuve.dateDebut, dateFin: epreuve.dateFin, engagements })
    pourCloture.push({
      statut,
      dateDebut: epreuve.dateDebut,
      engagements: epreuve.entries.map((entree, index) => ({
        statut: engagements[index],
        validation: entree.saisonResult?.validation ?? null,
      })),
    })
  }

  if (clotureProposee(pourCloture)) await proposerCloture(ctx, saison.id)

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

// Statut, kilométrage et cause d'un engagement à partir de son inscription et de son résultat.
// Le kilométrage et la cause suivent le résultat validé : ils sont vides sans résultat validé.
function calculerEngagement(
  entree: {
    statut: string
    kmChronometres: Prisma.Decimal | null
    causeAbandon: string | null
    saisonRegistration: { dossierEnvoyeLe: Date | null; payeLe: Date | null } | null
    saisonResult: { statutFinal: string; validation: string; kmChronometres: Prisma.Decimal | null; causeAbandon: string | null } | null
  },
  dateDebut: Date,
  maintenant: Date,
): { statut: StatutEngagement; km: string | null; kmDecimal: Prisma.Decimal | null; cause: string | null } {
  const reg = entree.saisonRegistration
  const res = entree.saisonResult
  const statut = statutEngagement(
    {
      dossierEnvoyeLe: reg?.dossierEnvoyeLe ?? null,
      payeLe: reg?.payeLe ?? null,
      dateDebutEpreuve: dateDebut,
      resultat: res ? { statutFinal: res.statutFinal as StatutResultat, validation: res.validation as ValidationResultat } : null,
    },
    maintenant,
  )
  const valide = res?.validation === "valide"
  const kmDecimal = valide && res ? res.kmChronometres : null
  const cause = valide && res ? causeAbandonEngagement({ statutFinal: res.statutFinal as StatutResultat, causeAbandon: res.causeAbandon }) : null
  return { statut, km: kmDecimal?.toString() ?? null, kmDecimal, cause }
}

// Recalcule le statut d'un engagement et l'écrit s'il a changé (appelée après une écriture ciblée).
async function synchroniserEntree(ctx: ContexteTeam, entryId: string): Promise<StatutEngagement> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: entryId, teamId: ctx.teamId, deletedAt: null },
    include: {
      event: { select: { dateDebut: true } },
      saisonRegistration: { select: { dossierEnvoyeLe: true, payeLe: true } },
      saisonResult: { select: { statutFinal: true, validation: true, kmChronometres: true, causeAbandon: true } },
    },
  })
  if (!engagement) refus("Engagement introuvable dans cette team.")

  const cible = calculerEngagement(engagement, engagement.event.dateDebut, new Date())
  if (cible.statut !== engagement.statut || cible.km !== (engagement.kmChronometres?.toString() ?? null) || cible.cause !== engagement.causeAbandon) {
    await client.coreEventEntry.updateMany({
      where: { id: entryId, teamId: ctx.teamId },
      data: { statut: cible.statut, kmChronometres: cible.kmDecimal, causeAbandon: cible.cause, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  }
  return cible.statut
}

// --- Fiche épreuve, spéciales, programme, inscription (tâche 2.2) ---------------------------

const schemaInfos = z
  .object({
    championnat: z.string().trim().max(200).nullable().optional(),
    lienResultats: z.string().trim().max(500).nullable().optional(),
    lienOfficiel: z.string().trim().max(500).nullable().optional(),
    lieu: z.string().trim().max(200).nullable().optional(),
    departement: z.string().trim().max(3).nullable().optional(),
    // Organisateur (core_event) et ASA (saison_event_info) : des contacts de la team, ou rien.
    organisateurContactId: z.string().uuid().nullable().optional(),
    asaContactId: z.string().uuid().nullable().optional(),
    engagementsOuverture: dateCivile.nullable().optional(),
    engagementsCloture: dateCivile.nullable().optional(),
    tarifNormal: z.number().int().min(0).nullable().optional(),
    tarifLicencieAsa: z.number().int().min(0).nullable().optional(),
    geolocalisationIncluse: z.boolean().optional(),
    nbSpeciales: z.number().int().min(0).nullable().optional(),
    kmChronometresPrevus: z.number().min(0).max(99999.9).nullable().optional(),
    kmTotal: z.number().min(0).max(99999.9).nullable().optional(),
    lieuParcAssistance: z.string().trim().max(300).nullable().optional(),
    adresseEnvoiDossier: z.string().trim().max(500).nullable().optional(),
  })
  .strict()

export type EntreeInfos = z.input<typeof schemaInfos>

export async function modifierInfosEpreuve(eventId: string, entree: EntreeInfos): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return modifierInfosEpreuveDans(ctx, eventId, entree)
}

export async function modifierInfosEpreuveDans(ctx: ContexteTeam, eventId: string, entree: EntreeInfos): Promise<void> {
  const donnees = schemaInfos.parse(entree)
  await garderSaisonOuverte(ctx, { eventId })
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({ where: { id: eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!epreuve) refus("Épreuve introuvable dans cette team.")

  const { lienOfficiel, lieu, departement, organisateurContactId, ...infos } = donnees
  for (const contactId of [organisateurContactId, infos.asaContactId]) {
    if (!contactId) continue
    const contact = await client.coreContact.findFirst({ where: { id: contactId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!contact) refus("Contact introuvable dans cette team.")
  }
  await client.coreEvent.updateMany({
    where: { id: eventId, teamId: ctx.teamId },
    data: {
      ...(organisateurContactId !== undefined ? { organisateurContactId } : {}),
      ...(lienOfficiel !== undefined ? { lienOfficiel: lienOfficiel || null } : {}),
      ...(lieu !== undefined ? { lieu: lieu || null } : {}),
      ...(departement !== undefined ? { departement: departement || null } : {}),
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })
  await client.saisonEventInfo.upsert({
    where: { eventId },
    create: { id: newId(), teamId: ctx.teamId, eventId, ...infos, createdBy: ctx.userId, updatedBy: ctx.userId },
    update: { ...infos, rev: { increment: 1 }, updatedBy: ctx.userId },
  })
}

const schemaSpeciale = z
  .object({
    numero: z.number().int().min(1, "Le numéro de spéciale commence à 1."),
    nom: z.string().trim().min(1, "Le nom de la spéciale est vide.").max(200),
    longueurKm: z.number().min(0).max(999.99).nullable().optional(),
    nbPassages: z.number().int().min(1).nullable().optional(),
    type: z.enum(["speciale", "manche_slalom", "montee"]),
  })
  .strict()

export type EntreeSpeciale = z.input<typeof schemaSpeciale>

export async function ajouterSpeciale(eventId: string, entree: EntreeSpeciale): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  const donnees = schemaSpeciale.parse(entree)
  await garderSaisonOuverte(ctx, { eventId })
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({ where: { id: eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!epreuve) refus("Épreuve introuvable dans cette team.")
  const doublon = await client.saisonStage.findFirst({ where: { eventId, numero: donnees.numero, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (doublon) refus(`La spéciale n° ${donnees.numero} existe déjà sur cette épreuve.`)
  await client.saisonStage.create({
    data: { id: newId(), teamId: ctx.teamId, eventId, ...donnees, createdBy: ctx.userId, updatedBy: ctx.userId },
  })
}

const schemaProgramme = z
  .object({
    type: z.enum(["verif_administratives", "verif_techniques", "shakedown", "depart", "passage_speciale", "regroupement", "assistance", "arrivee", "remise_des_prix"]),
    stageId: z.string().uuid().nullable().optional(),
    numeroPassage: z.number().int().min(1).nullable().optional(),
    heurePrevue: z.string().datetime().nullable().optional(),
    lieu: z.string().trim().max(200).nullable().optional(),
  })
  .strict()

export type EntreeProgramme = z.input<typeof schemaProgramme>

export async function ajouterProgramme(eventId: string, entree: EntreeProgramme): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  const donnees = schemaProgramme.parse(entree)
  await garderSaisonOuverte(ctx, { eventId })
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({ where: { id: eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!epreuve) refus("Épreuve introuvable dans cette team.")
  if (donnees.stageId) {
    const stage = await client.saisonStage.findFirst({ where: { id: donnees.stageId, eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!stage) refus("La spéciale n'appartient pas à cette épreuve.")
  }
  await client.saisonScheduleItem.create({
    data: {
      id: newId(),
      teamId: ctx.teamId,
      eventId,
      type: donnees.type,
      stageId: donnees.stageId ?? null,
      numeroPassage: donnees.numeroPassage ?? null,
      heurePrevue: donnees.heurePrevue ? new Date(donnees.heurePrevue) : null,
      lieu: donnees.lieu || null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  })
}

const schemaInscription = z
  .object({
    concurrentNom: z.string().trim().max(200).nullable().optional(),
    montantDu: z.number().int().min(0).nullable().optional(),
    dossierEnvoyeLe: z.string().datetime().nullable().optional(),
    confirmationRecueLe: z.string().datetime().nullable().optional(),
    listeEngagesPubliee: z.boolean().optional(),
    remarques: z.string().trim().max(2000).nullable().optional(),
    numeroCourse: z.string().trim().max(20).nullable().optional(),
    groupe: z.string().trim().max(40).nullable().optional(),
    classe: z.string().trim().max(40).nullable().optional(),
  })
  .strict()

export type EntreeInscription = z.input<typeof schemaInscription>

// Met à jour l'inscription et les champs de fiche de l'engagement, puis recalcule son statut.
export async function modifierInscription(entryId: string, entree: EntreeInscription): Promise<void> {
  const { ctx } = await accesSaison("ecriture")
  return modifierInscriptionDans(ctx, entryId, entree)
}

export async function modifierInscriptionDans(ctx: ContexteTeam, entryId: string, entree: EntreeInscription): Promise<void> {
  const donnees = schemaInscription.parse(entree)
  await garderSaisonOuverte(ctx, { entryId })
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagement = await client.coreEventEntry.findFirst({ where: { id: entryId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!engagement) refus("Engagement introuvable dans cette team.")

  const { numeroCourse, groupe, classe, dossierEnvoyeLe, confirmationRecueLe, ...inscription } = donnees
  await client.coreEventEntry.updateMany({
    where: { id: entryId, teamId: ctx.teamId },
    data: {
      ...(numeroCourse !== undefined ? { numeroCourse: numeroCourse || null } : {}),
      ...(groupe !== undefined ? { groupe: groupe || null } : {}),
      ...(classe !== undefined ? { classe: classe || null } : {}),
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })
  await client.saisonRegistration.updateMany({
    where: { entryId, teamId: ctx.teamId },
    data: {
      ...inscription,
      ...(dossierEnvoyeLe !== undefined ? { dossierEnvoyeLe: dossierEnvoyeLe ? new Date(dossierEnvoyeLe) : null } : {}),
      ...(confirmationRecueLe !== undefined ? { confirmationRecueLe: confirmationRecueLe ? new Date(confirmationRecueLe) : null } : {}),
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })
  await synchroniserEntree(ctx, entryId)
  await recalculerDans(ctx)
}

// Recalcul à l'ouverture du QG : sans effet si le membre n'a pas de niveau sur Saison.
export async function recalculerPourQg(ctx: ContexteTeam, niveau: Niveau): Promise<void> {
  if (niveau === "aucun") return
  await recalculerDans(ctx)
}

// --- Tâche 2.3 : garde de saison clôturée, actions de résultat, clôture proposée ----------------

// Refuse une écriture si la saison de l'épreuve (ou de l'engagement) est clôturée.
async function garderSaisonOuverte(ctx: ContexteTeam, cible: { eventId?: string; entryId?: string }): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  let eventId = cible.eventId ?? null
  if (!eventId && cible.entryId) {
    const engagement = await client.coreEventEntry.findFirst({ where: { id: cible.entryId, teamId: ctx.teamId }, select: { eventId: true } })
    eventId = engagement?.eventId ?? null
  }
  if (!eventId) return
  const epreuve = await client.coreEvent.findFirst({
    where: { id: eventId, teamId: ctx.teamId },
    select: { season: { select: { clotureeAt: true } } },
  })
  const message = refusEcritureSaison(epreuve?.season.clotureeAt ?? null)
  if (message) refus(message)
}

// Identifiant de l'action de boîte d'un résultat à valider : une seule par engagement.
function cleValidation(entryId: string): string {
  return `resultat_a_valider:${entryId}`
}

// Les membres qui peuvent valider : responsable et équipage actifs. Celui qui a saisi le résultat
// n'en fait pas partie, sauf s'il est responsable (même règle que transitionResultat).
async function destinatairesValidation(ctx: ContexteTeam, saisiParMembershipId: string | null): Promise<string[]> {
  const membres = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findMany({
    where: { teamId: ctx.teamId, statut: "actif", deletedAt: null, role: { in: ["responsable", "equipage"] } },
    select: { id: true, role: true },
  })
  return membres.filter((membre) => membre.id !== saisiParMembershipId || membre.role === "responsable").map((membre) => membre.id)
}

// Demande la validation dans la boîte d'actions, si le résultat est saisi ou à vérifier.
async function demanderValidation(ctx: ContexteTeam, entryId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const resultat = await client.saisonResult.findFirst({
    where: { entryId, teamId: ctx.teamId, deletedAt: null },
    select: { validation: true, saisiParMembershipId: true, statutFinal: true },
  })
  if (!resultat || (resultat.validation !== "saisi" && resultat.validation !== "a_verifier")) return

  const engagement = await client.coreEventEntry.findFirst({
    where: { id: entryId, teamId: ctx.teamId },
    select: { eventId: true, event: { select: { nom: true } }, vehicle: { select: { nomCourt: true } } },
  })
  if (!engagement) return
  const memberships = await destinatairesValidation(ctx, resultat.saisiParMembershipId)
  if (memberships.length === 0) return

  await emettre(ctx, "saison.action_requise", {
    type: "resultat_a_valider",
    cleUnicite: cleValidation(entryId),
    titre: `Valider le résultat : ${engagement.event.nom} (${engagement.vehicle.nomCourt})`,
    contexte: engagement.event.nom,
    ficheType: "resultat",
    ficheId: entryId,
    eventId: engagement.eventId,
    destinataires: { memberships },
    boutons: [{ cle: "valider", libelle: "Valider" }],
    priorite: PRIORITE_RESULTAT_A_VALIDER,
    niveauRequis: "ecriture",
    cleRegroupement: "resultats_a_valider",
  })
}

// Lève l'action de validation (validé ou contesté) : le membre n'a plus rien à faire ici.
async function lever(ctx: ContexteTeam, entryId: string): Promise<void> {
  await emettre(ctx, "saison.action_levee", { cleUnicite: cleValidation(entryId) })
}

// Propose la clôture de la saison dans la boîte d'actions, une seule fois (la clé ne se duplique pas).
async function proposerCloture(ctx: ContexteTeam, seasonId: string): Promise<void> {
  const cle = `cloture_saison:${seasonId}`
  const existante = await prismaPourTeam(ctx.teamId, ctx.userId).coreAction.findFirst({
    where: { teamId: ctx.teamId, cleUnicite: cle },
    select: { id: true },
  })
  if (existante) return
  const responsables = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findMany({
    where: { teamId: ctx.teamId, statut: "actif", deletedAt: null, role: "responsable" },
    select: { id: true },
  })
  if (responsables.length === 0) return
  await emettre(ctx, "saison.action_requise", {
    type: "cloture_saison_proposee",
    cleUnicite: cle,
    titre: "Clôturer la saison : tous les résultats partis sont validés",
    contexte: "Saison",
    ficheType: "saison",
    ficheId: seasonId,
    destinataires: { memberships: responsables.map((membre) => membre.id) },
    boutons: [
      { cle: "cloturer", libelle: "Clôturer la saison" },
      { cle: "plus_tard", libelle: "Plus tard" },
    ],
    priorite: PRIORITE_CLOTURE_PROPOSEE,
    niveauRequis: "gestion",
  })
}

// Décision prise dans la boîte d'actions : c'est ici que la règle s'applique vraiment.
// Une décision que la règle refuse rouvre l'action, pour que le membre voie qu'elle reste à faire.
async function appliquerDecision(ctx: ContexteTeam, evenement: { donnees: unknown }): Promise<void> {
  const donnees = evenement.donnees as { type?: string; decision?: string; cleUnicite?: string; ficheId?: string }
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  if (donnees.type === "resultat_a_valider" && donnees.decision === "valider" && donnees.ficheId) {
    try {
      await validerResultatDans(ctx, donnees.ficheId)
    } catch (erreur) {
      if (!(erreur instanceof ErreurSaison)) throw erreur
      await rouvrirAction(client, ctx, donnees.cleUnicite)
    }
  }

  if (donnees.type === "cloture_saison_proposee" && donnees.decision === "cloturer" && donnees.ficheId) {
    try {
      await cloturerSaisonDans(ctx, donnees.ficheId)
    } catch (erreur) {
      if (!(erreur instanceof ErreurSaison)) throw erreur
      await rouvrirAction(client, ctx, donnees.cleUnicite)
    }
  }
}

async function rouvrirAction(client: ReturnType<typeof prismaPourTeam>, ctx: ContexteTeam, cleUnicite: string | undefined): Promise<void> {
  if (!cleUnicite) return
  await client.coreAction.updateMany({
    where: { teamId: ctx.teamId, cleUnicite },
    data: { statut: "en_attente", decision: null, decideeParMembershipId: null, decideeAt: null },
  })
}

// Enregistré à l'import du module : l'app Saison reçoit les décisions de la boîte d'actions.
enregistrerGestionnaire("saison", "core.action_decidee", appliquerDecision)
