// Services serveur de Partenaires (tâche 3.5, brief section 5). Même structure que Voiture : chaque fonction
// publique passe par accesPartenaires(niveau) ; les fonctions « …Dans(ctx, …) » font le travail sans garde et
// servent aux vérifications de bus et aux scripts.
//
// Niveaux : responsable en gestion, équipage en écriture. L'assistance et l'invité n'y ont aucun accès.
// Pas d'écran dans cette tâche : les écrans viennent en 3.6 et 3.7.

import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { type FicheSource, rattacherDepuisSource, rattacherFichier } from "@/core/fichiers/fichiers-serveur"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { type Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import {
  chargeContrepartieEnRetard,
  chargeContrepartieTenue,
  chargeConventionSignee,
  chargeConventionTerminee,
  chargeRelanceDue,
  cleContrepartieEnRetard,
} from "./charges"
import { CATALOGUE_DEFAUT_V1, PREFIXE_SOURCE_CATALOGUE } from "./catalogue-defaut"
import { ErreurPartenaires, refus } from "./erreurs"
import { empreinteJeton, genererJeton } from "./jeton-serveur"
import { MODELE_DEFAUT_V2 } from "./modele-defaut"
import {
  enRetard,
  formaterMontant,
  jourParis,
  relanceDue,
  remplirModele,
  statutAutomatique,
  statutContrepartie,
  transitionConvention,
  type ContrepartieModele,
  type StatutContrepartie,
  type StatutConvention,
  type ValeurModele,
} from "./regles"

export { ErreurPartenaires }

// --- Accès ----------------------------------------------------------------------------------

export async function accesPartenaires(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("partenaires", requis)
  const ctx = { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } }
  return { ctx, niveau }
}

type Client = ReturnType<typeof prismaPourTeam>

const STATUTS_SAISIS = ["a_contacter", "contacte", "relance", "interesse", "refus"] as const
const SOURCES = ["reseau", "demarchage", "recommandation", "autre"] as const
const TYPES_INTERACTION = ["appel", "mail", "rencontre", "courrier", "autre"] as const
const TYPES_CONTREPARTIE = [
  "logo_voiture",
  "publication_reseaux",
  "story",
  "presence_exposition",
  "logo_tenues",
  "mention_dossier",
  "photo_dediee",
  "invitation_epreuve",
  "autre",
] as const
const TYPES_PREUVE = ["photo", "lien", "capture"] as const
const APPORT_RECU = ["non", "partiel", "oui"] as const
export const SECTIONS_PAGE = ["conventions", "contreparties", "preuves", "calendrier", "resultats", "bilans"] as const
const STATUTS_CLOS = ["terminee", "resiliee"] as const

// Priorité d'une action de retard : plus haute que le rappel des papiers de Voiture (4).
const PRIORITE_CONTREPARTIE_EN_RETARD = 5

const texte = (max: number) => z.string().trim().max(max).nullable().optional()
const identifiant = z.string().min(1)
const entier = z.number().int().min(0)
const jourCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ.")

// Les dates sans heure sont en minuit UTC (colonnes @db.Date).
function versJour(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`)
}

function versJourOuNull(jour: string | null | undefined): Date | null {
  return jour ? versJour(jour) : null
}

function jourDe(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

// Nom d'entreprise comparé sans casse ni espaces superflus : « Garage  Muller » = « garage muller ».
export function normaliserNom(nom: string): string {
  return nom.trim().replace(/\s+/g, " ").toLowerCase()
}

// Échéancier stocké en JSON : on relit seulement ce qui est bien formé.
const schemaEcheancier = z.array(z.object({ date: jourCivil, montantCentimes: entier }))

function echeancierDe(valeur: unknown): z.infer<typeof schemaEcheancier> {
  const lu = schemaEcheancier.safeParse(valeur)
  return lu.success ? lu.data : []
}

// --- Schémas d'entrée -----------------------------------------------------------------------

const schemaProspect = z.object({
  entreprise: z.string().trim().min(1, "Donnez le nom de l'entreprise.").max(120),
  contact: z
    .object({
      prenom: z.string().trim().min(1, "Donnez le prénom de l'interlocuteur.").max(60),
      nom: z.string().trim().min(1, "Donnez le nom de l'interlocuteur.").max(60),
    })
    .nullable()
    .optional(),
})

const schemaModifierPartenaire = z
  .object({
    statut: z.enum(STATUTS_SAISIS).optional(),
    source: z.enum(SOURCES).nullable().optional(),
    suiviParPersonId: identifiant.nullable().optional(),
    prochaineRelance: jourCivil.nullable().optional(),
    secteur: texte(80),
    notes: texte(4000),
  })
  .strict()

const schemaInteraction = z
  .object({
    date: jourCivil,
    type: z.enum(TYPES_INTERACTION),
    resume: z.string().trim().min(1, "Résumez l'échange.").max(2000),
    auteurPersonId: identifiant.nullable().optional(),
    prochaineAction: texte(300),
    prochaineActionLe: jourCivil.nullable().optional(),
  })
  .strict()

const schemaModele = z
  .object({
    nom: z.string().trim().min(1, "Donnez un nom au modèle.").max(120),
    texte: z.string().trim().min(1, "Le modèle ne peut pas être vide.").max(20000),
  })
  .strict()

const schemaConvention = z
  .object({
    partnerId: identifiant,
    templateId: identifiant,
    seasonId: identifiant.nullable().optional(),
    dateDebut: jourCivil,
    dateFin: jourCivil,
  })
  .strict()
  .refine((d) => d.dateFin >= d.dateDebut, { message: "La fin doit être après le début.", path: ["dateFin"] })

const schemaModifierConvention = z
  .object({
    templateId: identifiant.optional(),
    seasonId: identifiant.nullable().optional(),
    dateDebut: jourCivil.optional(),
    dateFin: jourCivil.optional(),
    apportFinancierCentimes: entier.optional(),
    devise: z.string().trim().length(3).optional(),
    apportNatureDescription: texte(500),
    apportNatureValeurCentimes: entier.nullable().optional(),
    echeancier: schemaEcheancier.optional(),
    apportRecu: z.enum(APPORT_RECU).optional(),
  })
  .strict()

const schemaSignature = z
  .object({
    signeeLe: jourCivil,
    signataires: z.string().trim().min(1, "Indiquez les signataires.").max(300),
    documentSigneFileId: identifiant.nullable().optional(),
  })
  .strict()

const schemaResiliation = z.object({ motif: z.string().trim().min(1, "Indiquez le motif de la résiliation.").max(1000) }).strict()

const schemaAvenant = z
  .object({
    date: jourCivil,
    motif: z.string().trim().min(1, "Indiquez le motif.").max(300),
    changements: z.string().trim().min(1, "Décrivez les changements.").max(4000),
    documentFileId: identifiant.nullable().optional(),
    signeLe: jourCivil.nullable().optional(),
  })
  .strict()

const schemaContrepartie = z
  .object({
    catalogId: identifiant.nullable().optional(),
    libelle: z.string().trim().max(200).optional(),
    type: z.enum(TYPES_CONTREPARTIE).optional(),
    quantitePromise: z.number().int().min(1).max(999).optional(),
    unite: texte(40),
  })
  .strict()
  .refine((d) => Boolean(d.catalogId) || Boolean(d.libelle), { message: "Choisissez une contrepartie de la liste, ou écrivez-la.", path: ["libelle"] })

const schemaModifierContrepartie = z
  .object({
    libelle: z.string().trim().min(1, "Donnez un libellé.").max(200).optional(),
    type: z.enum(TYPES_CONTREPARTIE).optional(),
    quantitePromise: z.number().int().min(1).max(999).optional(),
    slotId: identifiant.nullable().optional(),
    slotNom: texte(120),
    eventIds: z.array(identifiant).max(50).optional(),
    echeance: jourCivil.nullable().optional(),
  })
  .strict()
  .refine((d) => !d.slotId || Boolean(d.slotNom), { message: "Donnez le nom de l'emplacement.", path: ["slotNom"] })

const schemaPreuve = z
  .object({
    date: jourCivil,
    type: z.enum(TYPES_PREUVE),
    eventId: identifiant.nullable().optional(),
    fileId: identifiant.nullable().optional(),
    lien: z.string().trim().url("Lien invalide.").max(500).nullable().optional(),
    commentaire: texte(1000),
    visiblePartenaire: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Boolean(d.fileId) || Boolean(d.lien), { message: "Ajoutez un fichier ou un lien.", path: ["fichier"] })

const schemaSections = z.object({ sections: z.array(z.enum(SECTIONS_PAGE)) }).strict()

// --- Lectures d'accès partagées -------------------------------------------------------------

async function partenaireActifDans(client: Client, ctx: ContexteTeam, id: string) {
  const partenaire = await client.partenairesPartner.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    include: { contact: { select: { nom: true, categories: true } } },
  })
  if (!partenaire) refus("Partenaire introuvable.")
  return partenaire
}

async function conventionActiveDans(client: Client, ctx: ContexteTeam, id: string) {
  const convention = await client.partenairesAgreement.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    include: { partner: { include: { contact: { select: { nom: true, adresse: true } } } } },
  })
  if (!convention) refus("Convention introuvable.")
  return convention
}

async function contrepartieActiveDans(client: Client, ctx: ContexteTeam, id: string) {
  const contrepartie = await client.partenairesBenefit.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    include: { agreement: { include: { partner: { include: { contact: { select: { nom: true } } } } } } },
  })
  if (!contrepartie) refus("Contrepartie introuvable.")
  return contrepartie
}

async function fichierDeLEquipeDans(client: Client, ctx: ContexteTeam, fileId: string): Promise<void> {
  const fichier = await client.coreFile.findFirst({ where: { id: fileId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!fichier) refus("Fichier introuvable dans cette team.")
}

// --- Prospects ------------------------------------------------------------------------------

export async function creerProspect(entree: EntreeProspect): Promise<string> {
  const { ctx } = await accesPartenaires("ecriture")
  return creerProspectDans(ctx, entree)
}

export interface EntreeProspect {
  entreprise: string
  contact?: { prenom: string; nom: string } | null
}

// Le « + » en deux champs : l'entreprise (qui réutilise un core_contact de même nom) et l'interlocuteur facultatif.
export async function creerProspectDans(ctx: ContexteTeam, entree: EntreeProspect): Promise<string> {
  const donnees = schemaProspect.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const contacts = await client.coreContact.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { id: true, nom: true, categories: true },
  })
  const existant = contacts.find((contact) => normaliserNom(contact.nom) === normaliserNom(donnees.entreprise)) ?? null

  if (existant) {
    const dejaPartenaire = await client.partenairesPartner.findFirst({
      where: { teamId: ctx.teamId, contactId: existant.id, deletedAt: null },
      select: { id: true },
    })
    if (dejaPartenaire) refus("Cette entreprise est déjà dans Partenaires.")
  }

  const id = newId()
  const contactId = existant?.id ?? newId()
  const personneId = donnees.contact ? newId() : null

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    if (existant) {
      const categories = existant.categories.includes("partenaire") ? existant.categories : [...existant.categories, "partenaire" as const]
      await tx.coreContact.update({
        where: { id: contactId },
        data: { categories, rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    } else {
      await tx.coreContact.create({
        data: {
          id: contactId,
          teamId: ctx.teamId,
          nom: donnees.entreprise,
          categories: ["partenaire"],
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    }
    if (donnees.contact && personneId) {
      await tx.corePerson.create({
        data: {
          id: personneId,
          teamId: ctx.teamId,
          prenom: donnees.contact.prenom,
          nom: donnees.contact.nom,
          contactId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    }
    await tx.partenairesPartner.create({
      data: {
        id,
        teamId: ctx.teamId,
        contactId,
        interlocuteurPersonId: personneId,
        statut: "a_contacter",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  })
  return id
}

export async function modifierPartenaire(id: string, entree: EntreePartenaire): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return modifierPartenaireDans(ctx, id, entree)
}

export type EntreePartenaire = z.input<typeof schemaModifierPartenaire>

export async function modifierPartenaireDans(ctx: ContexteTeam, id: string, entree: EntreePartenaire): Promise<void> {
  const donnees = schemaModifierPartenaire.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await partenaireActifDans(client, ctx, id)

  if (donnees.suiviParPersonId) {
    const personne = await client.corePerson.findFirst({ where: { id: donnees.suiviParPersonId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!personne) refus("La personne choisie pour le suivi est introuvable.")
  }

  const champs: Record<string, unknown> = {}
  if (donnees.statut !== undefined) champs.statut = donnees.statut
  if (donnees.source !== undefined) champs.source = donnees.source
  if (donnees.suiviParPersonId !== undefined) champs.suiviParPersonId = donnees.suiviParPersonId
  if (donnees.prochaineRelance !== undefined) champs.prochaineRelance = versJourOuNull(donnees.prochaineRelance)
  if (donnees.secteur !== undefined) champs.secteur = donnees.secteur || null
  if (donnees.notes !== undefined) champs.notes = donnees.notes || null

  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesPartner.update({ where: { id }, data: { ...champs, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

export async function poserLogoPartenaire(partnerId: string, fileId: string): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return poserLogoPartenaireDans(ctx, partnerId, fileId)
}

export async function poserLogoPartenaireDans(ctx: ContexteTeam, partnerId: string, fileId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await partenaireActifDans(client, ctx, partnerId)
  // Identifiant vide : « Retirer le logo » de la fiche.
  if (fileId === "") {
    await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.partenairesPartner.update({ where: { id: partnerId }, data: { logoFileId: null, rev: { increment: 1 }, updatedBy: ctx.userId } }),
    )
    return
  }
  await fichierDeLEquipeDans(client, ctx, fileId)
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesPartner.update({
      where: { id: partnerId },
      data: { logoFileId: fileId, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    await rattacherFichier(tx, ctx, { fileId, app: "partenaires", ficheType: "partner", ficheId: partnerId, role: "photo" })
  })
}

// Coordonnées de l'entreprise : seulement les cinq champs du contact rattaché au partenaire (brief 3.6, §4).
// Le socle n'a pas de service de contacts : celui-ci ne touche que ce partenaire-là, jamais un autre contact.
const schemaCoordonnees = z
  .object({
    adresse: z.string().trim().max(300).optional(),
    telephone: z.string().trim().max(30).optional(),
    email: z.string().trim().max(200).email("Adresse mail invalide.").or(z.literal("")).optional(),
    site: z.string().trim().max(200).optional(),
    siret: z.string().trim().regex(/^(\d{14})?$/, "Le SIRET compte 14 chiffres.").optional(),
  })
  .strict()

export type EntreeCoordonnees = z.input<typeof schemaCoordonnees>

export async function modifierCoordonnees(partnerId: string, entree: EntreeCoordonnees): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return modifierCoordonneesDans(ctx, partnerId, entree)
}

export async function modifierCoordonneesDans(ctx: ContexteTeam, partnerId: string, entree: EntreeCoordonnees): Promise<void> {
  const donnees = schemaCoordonnees.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const partenaire = await client.partenairesPartner.findFirst({
    where: { id: partnerId, teamId: ctx.teamId, deletedAt: null },
    select: { contactId: true },
  })
  if (!partenaire) refus("Partenaire introuvable.")
  const champs: Record<string, string | null> = {}
  for (const [cle, valeur] of Object.entries(donnees)) {
    if (valeur !== undefined) champs[cle] = valeur === "" ? null : valeur
  }
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.coreContact.update({
      where: { id: partenaire.contactId },
      data: { ...champs, rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )
}

// Interlocuteur du partenaire (brief 3.11, §1) : son nom, et sa fonction (par exemple « Gérant ») qui s'écrit après son
// nom dans la convention (brief 3.9, §4). Le nom crée la personne liée au partenaire, comme la création du prospect ; la
// modifier met à jour cette personne ; la vider retire l'interlocuteur et sa fonction.
const schemaInterlocuteur = z
  .object({
    personne: z
      .object({
        prenom: z.string().trim().min(1, "Donnez le prénom de l'interlocuteur.").max(60),
        nom: z.string().trim().min(1, "Donnez le nom de l'interlocuteur.").max(60),
      })
      .nullable(),
    qualite: z.string().trim().max(80).nullable(),
  })
  .strict()

export interface EntreeInterlocuteur {
  personne: { prenom: string; nom: string } | null
  qualite: string | null
}

export async function modifierInterlocuteur(partnerId: string, entree: EntreeInterlocuteur): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return modifierInterlocuteurDans(ctx, partnerId, entree)
}

export async function modifierInterlocuteurDans(ctx: ContexteTeam, partnerId: string, entree: EntreeInterlocuteur): Promise<void> {
  const donnees = schemaInterlocuteur.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const partenaire = await partenaireActifDans(client, ctx, partnerId)
  const personne = donnees.personne
  // Sans interlocuteur, il n'y a pas de fonction à garder.
  const qualite = personne ? donnees.qualite || null : null

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    let personneId: string | null = null
    if (personne && partenaire.interlocuteurPersonId) {
      personneId = partenaire.interlocuteurPersonId
      await tx.corePerson.update({
        where: { id: personneId },
        data: { prenom: personne.prenom, nom: personne.nom, rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    } else if (personne) {
      personneId = newId()
      await tx.corePerson.create({
        data: {
          id: personneId,
          teamId: ctx.teamId,
          prenom: personne.prenom,
          nom: personne.nom,
          contactId: partenaire.contactId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    } else if (partenaire.interlocuteurPersonId) {
      await tx.corePerson.update({
        where: { id: partenaire.interlocuteurPersonId },
        data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    }
    await tx.partenairesPartner.update({
      where: { id: partnerId },
      data: { interlocuteurPersonId: personneId, interlocuteurQualite: qualite, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
}

export async function supprimerPartenaire(id: string): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return supprimerPartenaireDans(ctx, id)
}

// Supprimer un partenaire n'est possible que sans convention signée (ni résiliée, ni terminée).
export async function supprimerPartenaireDans(ctx: ContexteTeam, id: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await partenaireActifDans(client, ctx, id)
  const signees = await client.partenairesAgreement.count({
    where: { teamId: ctx.teamId, partnerId: id, deletedAt: null, statut: { notIn: ["brouillon", "envoyee"] } },
  })
  if (signees > 0) refus("Ce partenaire a une convention signée : il ne peut pas être supprimé.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesPartner.update({ where: { id }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

// --- Échanges -------------------------------------------------------------------------------

export type EntreeInteraction = z.input<typeof schemaInteraction>

export async function ajouterInteraction(partnerId: string, entree: EntreeInteraction): Promise<string> {
  const { ctx } = await accesPartenaires("ecriture")
  return ajouterInteractionDans(ctx, partnerId, entree)
}

// Une prochaine action datée devient la prochaine relance du partenaire.
export async function ajouterInteractionDans(ctx: ContexteTeam, partnerId: string, entree: EntreeInteraction): Promise<string> {
  const donnees = schemaInteraction.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await partenaireActifDans(client, ctx, partnerId)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesInteraction.create({
      data: {
        id,
        teamId: ctx.teamId,
        partnerId,
        date: versJour(donnees.date),
        type: donnees.type,
        resume: donnees.resume,
        auteurPersonId: donnees.auteurPersonId ?? null,
        prochaineAction: donnees.prochaineAction || null,
        prochaineActionLe: versJourOuNull(donnees.prochaineActionLe),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    if (donnees.prochaineActionLe) {
      await tx.partenairesPartner.update({
        where: { id: partnerId },
        data: { prochaineRelance: versJour(donnees.prochaineActionLe), rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    }
  })
  return id
}

export async function modifierInteraction(id: string, entree: EntreeInteraction): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return modifierInteractionDans(ctx, id, entree)
}

export async function modifierInteractionDans(ctx: ContexteTeam, id: string, entree: EntreeInteraction): Promise<void> {
  const donnees = schemaInteraction.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await client.partenairesInteraction.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { partnerId: true } })
  if (!avant) refus("Échange introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesInteraction.update({
      where: { id },
      data: {
        date: versJour(donnees.date),
        type: donnees.type,
        resume: donnees.resume,
        auteurPersonId: donnees.auteurPersonId ?? null,
        prochaineAction: donnees.prochaineAction || null,
        prochaineActionLe: versJourOuNull(donnees.prochaineActionLe),
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    if (donnees.prochaineActionLe) {
      await tx.partenairesPartner.update({
        where: { id: avant.partnerId },
        data: { prochaineRelance: versJour(donnees.prochaineActionLe), rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    }
  })
}

export async function supprimerInteraction(id: string): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return supprimerInteractionDans(ctx, id)
}

export async function supprimerInteractionDans(ctx: ContexteTeam, id: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existe = await client.partenairesInteraction.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!existe) refus("Échange introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesInteraction.update({ where: { id }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

// --- Modèles de convention ------------------------------------------------------------------

export async function lireModeles() {
  const { ctx } = await accesPartenaires("ecriture")
  return lireModelesDans(ctx)
}

// Copie le modèle par défaut à la première lecture, puis renvoie les modèles de la team. Sûr en concurrence :
// l'index unique partiel (team_id, source_cle) refuse le doublon, skipDuplicates le laisse passer sans erreur.
export async function lireModelesDans(ctx: ContexteTeam) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesTemplate.createMany({
      data: [
        {
          id: newId(),
          teamId: ctx.teamId,
          nom: MODELE_DEFAUT_V2.nom,
          texte: MODELE_DEFAUT_V2.texte,
          version: MODELE_DEFAUT_V2.version,
          actif: true,
          sourceCle: MODELE_DEFAUT_V2.sourceCle,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      ],
      skipDuplicates: true,
    }),
  )
  return client.partenairesTemplate.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  })
}

// --- Liste de base des contreparties --------------------------------------------------------

export async function lireCatalogue() {
  const { ctx } = await accesPartenaires("ecriture")
  return lireCatalogueDans(ctx)
}

// Copie la liste de base à la première lecture, puis la renvoie. Même garantie que le modèle : une seule ligne
// par team et par clé, même si deux lectures arrivent ensemble.
export async function lireCatalogueDans(ctx: ContexteTeam) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesBenefitCatalog.createMany({
      data: CATALOGUE_DEFAUT_V1.map((ligne) => ({
        id: newId(),
        teamId: ctx.teamId,
        nom: ligne.nom,
        type: ligne.type,
        unite: ligne.unite,
        quantiteDefaut: ligne.quantiteDefaut,
        ordre: ligne.ordre,
        actif: true,
        sourceCle: `${PREFIXE_SOURCE_CATALOGUE}${ligne.cle}`,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })),
      skipDuplicates: true,
    }),
  )
  return client.partenairesBenefitCatalog.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    orderBy: [{ ordre: "asc" }, { nom: "asc" }],
  })
}

// --- Liste de base : écriture (gestion) -----------------------------------------------------

const schemaCatalogue = z
  .object({
    nom: z.string().trim().min(1, "Donnez un nom à la contrepartie.").max(120),
    type: z.enum(TYPES_CONTREPARTIE),
    unite: z.string().trim().min(1, "Donnez une unité, par exemple « publication ».").max(40),
    quantiteDefaut: z.number().int().min(1).max(999),
    ordre: z.number().int().min(0).max(999),
    actif: z.boolean(),
  })
  .strict()

export type EntreeCatalogue = z.input<typeof schemaCatalogue>

export async function creerCatalogue(entree: EntreeCatalogue): Promise<string> {
  const { ctx } = await accesPartenaires("gestion")
  return creerCatalogueDans(ctx, entree)
}

export async function creerCatalogueDans(ctx: ContexteTeam, entree: EntreeCatalogue): Promise<string> {
  const donnees = schemaCatalogue.parse(entree)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesBenefitCatalog.create({
      data: { id, teamId: ctx.teamId, ...donnees, sourceCle: null, createdBy: ctx.userId, updatedBy: ctx.userId },
    }),
  )
  return id
}

export async function modifierCatalogue(id: string, entree: EntreeCatalogue): Promise<void> {
  const { ctx } = await accesPartenaires("gestion")
  return modifierCatalogueDans(ctx, id, entree)
}

export async function modifierCatalogueDans(ctx: ContexteTeam, id: string, entree: EntreeCatalogue): Promise<void> {
  const donnees = schemaCatalogue.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existe = await client.partenairesBenefitCatalog.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!existe) refus("Contrepartie de la liste introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesBenefitCatalog.update({ where: { id }, data: { ...donnees, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

export async function creerModele(entree: EntreeModele): Promise<string> {
  const { ctx } = await accesPartenaires("gestion")
  return creerModeleDans(ctx, entree)
}

export type EntreeModele = z.input<typeof schemaModele>

export async function creerModeleDans(ctx: ContexteTeam, entree: EntreeModele): Promise<string> {
  const donnees = schemaModele.parse(entree)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesTemplate.create({
      data: { id, teamId: ctx.teamId, nom: donnees.nom, texte: donnees.texte, version: 1, actif: true, createdBy: ctx.userId, updatedBy: ctx.userId },
    }),
  )
  return id
}

// Une modification incrémente la version du modèle (les conventions déjà générées gardent leur texte).
export async function modifierModele(id: string, entree: EntreeModele): Promise<void> {
  const { ctx } = await accesPartenaires("gestion")
  return modifierModeleDans(ctx, id, entree)
}

export async function modifierModeleDans(ctx: ContexteTeam, id: string, entree: EntreeModele): Promise<void> {
  const donnees = schemaModele.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existant = await client.partenairesTemplate.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!existant) refus("Modèle introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesTemplate.update({
      where: { id },
      data: { nom: donnees.nom, texte: donnees.texte, version: { increment: 1 }, rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )
}

export async function changerActifModele(id: string, actif: boolean): Promise<void> {
  const { ctx } = await accesPartenaires("gestion")
  return changerActifModeleDans(ctx, id, actif)
}

export async function changerActifModeleDans(ctx: ContexteTeam, id: string, actif: boolean): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existant = await client.partenairesTemplate.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!existant) refus("Modèle introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesTemplate.update({ where: { id }, data: { actif, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

// --- Conventions ----------------------------------------------------------------------------

export async function creerConvention(entree: EntreeConvention): Promise<string> {
  const { ctx } = await accesPartenaires("ecriture")
  return creerConventionDans(ctx, entree)
}

export type EntreeConvention = z.input<typeof schemaConvention>

export async function creerConventionDans(ctx: ContexteTeam, entree: EntreeConvention, precedenteId: string | null = null): Promise<string> {
  const donnees = schemaConvention.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await partenaireActifDans(client, ctx, donnees.partnerId)
  const modele = await client.partenairesTemplate.findFirst({ where: { id: donnees.templateId, teamId: ctx.teamId, deletedAt: null, actif: true }, select: { id: true } })
  if (!modele) refus("Modèle de convention introuvable ou désactivé.")
  if (donnees.seasonId) {
    const saison = await client.coreSeason.findFirst({ where: { id: donnees.seasonId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!saison) refus("Saison introuvable.")
  }
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesAgreement.create({
      data: {
        id,
        teamId: ctx.teamId,
        partnerId: donnees.partnerId,
        templateId: donnees.templateId,
        seasonId: donnees.seasonId ?? null,
        dateDebut: versJour(donnees.dateDebut),
        dateFin: versJour(donnees.dateFin),
        statut: "brouillon",
        precedenteId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  return id
}

// Une convention ne se modifie qu'en brouillon.
export async function modifierConvention(id: string, entree: EntreeModifierConvention): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return modifierConventionDans(ctx, id, entree)
}

export type EntreeModifierConvention = z.input<typeof schemaModifierConvention>

export async function modifierConventionDans(ctx: ContexteTeam, id: string, entree: EntreeModifierConvention): Promise<void> {
  const donnees = schemaModifierConvention.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const convention = await conventionActiveDans(client, ctx, id)
  if (convention.statut !== "brouillon") refus("Une convention ne se modifie qu'au brouillon.")

  const dateDebut = donnees.dateDebut ?? jourDe(convention.dateDebut) ?? ""
  const dateFin = donnees.dateFin ?? jourDe(convention.dateFin) ?? ""
  if (dateFin < dateDebut) refus("La fin doit être après le début.")

  if (donnees.templateId) {
    const modele = await client.partenairesTemplate.findFirst({ where: { id: donnees.templateId, teamId: ctx.teamId, deletedAt: null, actif: true }, select: { id: true } })
    if (!modele) refus("Modèle de convention introuvable ou désactivé.")
  }
  if (donnees.seasonId) {
    const saison = await client.coreSeason.findFirst({ where: { id: donnees.seasonId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!saison) refus("Saison introuvable.")
  }

  const champs: Record<string, unknown> = {}
  if (donnees.templateId !== undefined) champs.templateId = donnees.templateId
  if (donnees.seasonId !== undefined) champs.seasonId = donnees.seasonId
  if (donnees.dateDebut !== undefined) champs.dateDebut = versJour(donnees.dateDebut)
  if (donnees.dateFin !== undefined) champs.dateFin = versJour(donnees.dateFin)
  if (donnees.apportFinancierCentimes !== undefined) champs.apportFinancierCentimes = donnees.apportFinancierCentimes
  if (donnees.devise !== undefined) champs.devise = donnees.devise.toUpperCase()
  if (donnees.apportNatureDescription !== undefined) champs.apportNatureDescription = donnees.apportNatureDescription || null
  if (donnees.apportNatureValeurCentimes !== undefined) champs.apportNatureValeurCentimes = donnees.apportNatureValeurCentimes
  if (donnees.echeancier !== undefined) champs.echeancier = donnees.echeancier
  if (donnees.apportRecu !== undefined) champs.apportRecu = donnees.apportRecu

  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesAgreement.update({ where: { id }, data: { ...champs, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

// Le texte de la convention, avec les champs remplis. Le PDF et son fichier viennent à la 3.6.
export async function genererDocument(agreementId: string) {
  const { ctx } = await accesPartenaires("ecriture")
  return genererDocumentDans(ctx, agreementId)
}

export async function genererDocumentDans(ctx: ContexteTeam, agreementId: string) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const convention = await conventionActiveDans(client, ctx, agreementId)
  const modele = convention.templateId
    ? await client.partenairesTemplate.findFirst({ where: { id: convention.templateId, teamId: ctx.teamId, deletedAt: null }, select: { texte: true } })
    : null
  if (!modele) refus("Cette convention n'a pas de modèle.")

  const equipe = await client.coreTeam.findFirst({
    where: { id: ctx.teamId },
    select: { nom: true, associationNom: true, formeJuridique: true, associationRna: true, associationSiege: true, signataireNom: true, signataireQualite: true },
  })
  if (!equipe) refus("Team introuvable.")
  const saison = convention.seasonId
    ? await client.coreSeason.findFirst({ where: { id: convention.seasonId, teamId: ctx.teamId, deletedAt: null }, select: { nom: true } })
    : null
  const interlocuteur = convention.partner.interlocuteurPersonId
    ? await client.corePerson.findFirst({ where: { id: convention.partner.interlocuteurPersonId, teamId: ctx.teamId, deletedAt: null }, select: { prenom: true, nom: true } })
    : null
  const benefices = await client.partenairesBenefit.findMany({
    where: { agreementId, teamId: ctx.teamId, deletedAt: null },
    include: { catalog: { select: { unite: true } } },
    orderBy: { createdAt: "asc" },
  })
  const evenements = await client.coreEvent.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, id: { in: benefices.flatMap((b) => b.eventIds) } },
    select: { id: true, nom: true },
  })
  const nomEpreuve = new Map(evenements.map((e) => [e.id, e.nom]))

  const contreparties: ContrepartieModele[] = benefices.map((b) => ({
    libelle: b.libelle,
    quantite: b.quantitePromise,
    unite: b.catalog?.unite ?? null,
    emplacement: b.slotNom,
    epreuves: b.eventIds.map((id) => nomEpreuve.get(id)).filter((nom): nom is string => Boolean(nom)),
    echeance: jourDe(b.echeance),
  }))

  const echeancier = echeancierDe(convention.echeancier)
  const valeurs: Record<string, ValeurModele> = {
    "team.nom": equipe.associationNom ?? equipe.nom,
    "team.forme_juridique": equipe.formeJuridique,
    "team.rna": equipe.associationRna,
    "team.adresse": equipe.associationSiege,
    "team.representant": [equipe.signataireNom, equipe.signataireQualite].filter(Boolean).join(", ") || null,
    "partenaire.entreprise": convention.partner.contact.nom,
    "partenaire.adresse": convention.partner.contact.adresse,
    // Fonction après le nom : « Marc Dupont, Gérant » (brief 3.9, §4).
    "partenaire.representant": interlocuteur
      ? [`${interlocuteur.prenom} ${interlocuteur.nom}`, convention.partner.interlocuteurQualite].filter(Boolean).join(", ")
      : null,
    "convention.apport_financier": formaterMontant(convention.apportFinancierCentimes),
    "convention.apport_nature": convention.apportNatureDescription
      ? `${convention.apportNatureDescription}${convention.apportNatureValeurCentimes ? `, valeur estimée ${formaterMontant(convention.apportNatureValeurCentimes)}` : ""}`
      : "aucun",
    "convention.echeancier": echeancier.length
      ? echeancier.map((v) => `${versJourFrancais(v.date)} : ${formaterMontant(v.montantCentimes)}`).join(" ; ")
      : "aucun",
    "convention.date_debut": jourDe(convention.dateDebut) ? versJourFrancais(jourDe(convention.dateDebut) ?? "") : null,
    "convention.date_fin": jourDe(convention.dateFin) ? versJourFrancais(jourDe(convention.dateFin) ?? "") : null,
    "convention.saison": saison?.nom ?? null,
    contreparties,
  }
  const rendu = remplirModele(modele.texte, valeurs)
  // Sans fonction, la ligne « Qualité » de la signature reste à remplir à la main : la fiche convention le signale.
  if (interlocuteur && !convention.partner.interlocuteurQualite) return { ...rendu, vides: [...rendu.vides, "partenaire.qualite"] }
  return rendu
}

// « 2027-06-30 » → « 30/06/2027 ».
function versJourFrancais(jour: string): string {
  const [annee, mois, date] = jour.split("-")
  return `${date}/${mois}/${annee}`
}

export async function marquerEnvoyee(agreementId: string): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return marquerEnvoyeeDans(ctx, agreementId)
}

export async function marquerEnvoyeeDans(ctx: ContexteTeam, agreementId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const convention = await conventionActiveDans(client, ctx, agreementId)
  const transition = transitionConvention(convention.statut, "envoyer")
  if (!transition.ok) refus(transition.message)
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesAgreement.update({ where: { id: agreementId }, data: { statut: transition.statut, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

// Signature : la convention passe en signée, le partenaire devient « partenaire », et l'événement part avec les
// contreparties logo (avec leur emplacement). Demande le niveau gestion.
export async function marquerSignee(agreementId: string, entree: EntreeSignature): Promise<void> {
  const { ctx } = await accesPartenaires("gestion")
  return marquerSigneeDans(ctx, agreementId, entree)
}

export type EntreeSignature = z.input<typeof schemaSignature>

export async function marquerSigneeDans(ctx: ContexteTeam, agreementId: string, entree: EntreeSignature): Promise<void> {
  const donnees = schemaSignature.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const convention = await conventionActiveDans(client, ctx, agreementId)
  const transition = transitionConvention(convention.statut, "signer")
  if (!transition.ok) refus(transition.message)
  if (donnees.documentSigneFileId) await fichierDeLEquipeDans(client, ctx, donnees.documentSigneFileId)

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesAgreement.update({
      where: { id: agreementId },
      data: {
        statut: transition.statut,
        signeeLe: versJour(donnees.signeeLe),
        signataires: donnees.signataires,
        documentSigneFileId: donnees.documentSigneFileId ?? null,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    await tx.partenairesPartner.update({
      where: { id: convention.partnerId },
      data: { statut: "partenaire", rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    if (donnees.documentSigneFileId) {
      await rattacherFichier(tx, ctx, { fileId: donnees.documentSigneFileId, app: "partenaires", ficheType: "agreement", ficheId: agreementId, role: "document" })
    }
  })

  const logos = await client.partenairesBenefit.findMany({
    where: { agreementId, teamId: ctx.teamId, deletedAt: null, type: "logo_voiture", slotId: { not: null } },
    select: { id: true, slotId: true, slotNom: true },
  })
  await emettre(
    ctx,
    "partenaires.convention_signee",
    chargeConventionSignee.parse({
      agreementId,
      partnerId: convention.partnerId,
      partenaireNom: convention.partner.contact.nom,
      dateDebut: jourDe(convention.dateDebut) ?? "",
      dateFin: jourDe(convention.dateFin) ?? "",
      apportFinancierCentimes: convention.apportFinancierCentimes,
      echeancier: echeancierDe(convention.echeancier),
      logoFileId: convention.partner.logoFileId,
      contreparties: logos.map((l) => ({ benefitId: l.id, slotId: l.slotId as string, slotNom: l.slotNom })),
    }),
  )
}

export async function resilier(agreementId: string, entree: { motif: string }): Promise<void> {
  const { ctx } = await accesPartenaires("gestion")
  return resilierDans(ctx, agreementId, entree)
}

export async function resilierDans(ctx: ContexteTeam, agreementId: string, entree: { motif: string }): Promise<void> {
  const donnees = schemaResiliation.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const convention = await conventionActiveDans(client, ctx, agreementId)
  const transition = transitionConvention(convention.statut, "resilier")
  if (!transition.ok) refus(transition.message)
  // Les emplacements se calculent avant la mise à jour : la convention ne doit pas se compter elle-même.
  const slotIds = await emplacementsALiberer(client, ctx, convention)
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesAgreement.update({
      where: { id: agreementId },
      data: { statut: transition.statut, motifResiliation: donnees.motif, rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )
  await emettre(
    ctx,
    "partenaires.convention_terminee",
    chargeConventionTerminee.parse({
      agreementId,
      partnerId: convention.partnerId,
      partenaireNom: convention.partner.contact.nom,
      motif: "resiliee",
      slotIds,
    }),
  )
}

// Emplacements à libérer quand une convention s'arrête : ceux de ses contreparties logo qu'aucune autre convention
// signée ou en cours du même partenaire ne couvre. Un renouvellement ne libère donc rien.
async function emplacementsALiberer(client: Client, ctx: ContexteTeam, convention: { id: string; partnerId: string }): Promise<string[]> {
  const logos = await client.partenairesBenefit.findMany({
    where: { agreementId: convention.id, teamId: ctx.teamId, deletedAt: null, type: "logo_voiture", slotId: { not: null } },
    select: { slotId: true },
  })
  const couverts = await client.partenairesBenefit.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      type: "logo_voiture",
      slotId: { not: null },
      agreementId: { not: convention.id },
      agreement: { partnerId: convention.partnerId, statut: { in: ["signee", "en_cours"] }, deletedAt: null },
    },
    select: { slotId: true },
  })
  const dejaCouverts = new Set(couverts.map((c) => c.slotId))
  return Array.from(new Set(logos.map((l) => l.slotId as string))).filter((slotId) => !dejaCouverts.has(slotId))
}

// Renouvellement : un brouillon pour la saison suivante, avec les mêmes contreparties (sans preuve ni avancement).
export async function renouveler(agreementId: string): Promise<string> {
  const { ctx } = await accesPartenaires("ecriture")
  return renouvelerDans(ctx, agreementId)
}

export async function renouvelerDans(ctx: ContexteTeam, agreementId: string): Promise<string> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const source = await conventionActiveDans(client, ctx, agreementId)
  if (!["signee", "en_cours", "terminee"].includes(source.statut)) refus("Seule une convention signée peut être renouvelée.")
  if (!source.seasonId) refus("Cette convention n'est rattachée à aucune saison : impossible de déterminer la saison suivante.")
  const saisonSource = await client.coreSeason.findFirst({ where: { id: source.seasonId, teamId: ctx.teamId, deletedAt: null }, select: { annee: true } })
  const saisonSuivante = saisonSource
    ? await client.coreSeason.findFirst({ where: { teamId: ctx.teamId, annee: saisonSource.annee + 1, deletedAt: null }, select: { id: true, dateDebut: true, dateFin: true } })
    : null
  if (!saisonSuivante) refus("Créez d'abord la saison suivante, dans Saison.")

  const benefices = await client.partenairesBenefit.findMany({ where: { agreementId, teamId: ctx.teamId, deletedAt: null } })
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesAgreement.create({
      data: {
        id,
        teamId: ctx.teamId,
        partnerId: source.partnerId,
        templateId: source.templateId,
        seasonId: saisonSuivante.id,
        dateDebut: saisonSuivante.dateDebut,
        dateFin: saisonSuivante.dateFin,
        statut: "brouillon",
        precedenteId: source.id,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    for (const b of benefices) {
      await tx.partenairesBenefit.create({
        data: {
          id: newId(),
          teamId: ctx.teamId,
          agreementId: id,
          catalogId: b.catalogId,
          libelle: b.libelle,
          type: b.type,
          quantitePromise: b.quantitePromise,
          quantiteTenue: 0,
          slotId: b.slotId,
          slotNom: b.slotNom,
          eventIds: [],
          echeance: null,
          statut: "a_faire",
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    }
  })
  return id
}

// --- Avenants -------------------------------------------------------------------------------

export async function ajouterAvenant(agreementId: string, entree: EntreeAvenant): Promise<string> {
  const { ctx } = await accesPartenaires("gestion")
  return ajouterAvenantDans(ctx, agreementId, entree)
}

export type EntreeAvenant = z.input<typeof schemaAvenant>

// Un avenant se signe sur une convention signée ou en cours. Le numéro suit le précédent.
export async function ajouterAvenantDans(ctx: ContexteTeam, agreementId: string, entree: EntreeAvenant): Promise<string> {
  const donnees = schemaAvenant.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const convention = await conventionActiveDans(client, ctx, agreementId)
  if (!["signee", "en_cours"].includes(convention.statut)) refus("Un avenant ne s'ajoute qu'à une convention signée ou en cours.")
  if (donnees.documentFileId) await fichierDeLEquipeDans(client, ctx, donnees.documentFileId)

  const dernier = await client.partenairesAmendment.findFirst({
    where: { agreementId, teamId: ctx.teamId, deletedAt: null },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesAmendment.create({
      data: {
        id,
        teamId: ctx.teamId,
        agreementId,
        numero: (dernier?.numero ?? 0) + 1,
        date: versJour(donnees.date),
        motif: donnees.motif,
        changements: donnees.changements,
        documentFileId: donnees.documentFileId ?? null,
        signeLe: versJourOuNull(donnees.signeLe),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    if (donnees.documentFileId) {
      await rattacherFichier(tx, ctx, { fileId: donnees.documentFileId, app: "partenaires", ficheType: "amendment", ficheId: id, role: "document" })
    }
  })
  return id
}

// --- Contreparties --------------------------------------------------------------------------

export async function ajouterContrepartie(agreementId: string, entree: EntreeContrepartie): Promise<string> {
  const { ctx } = await accesPartenaires("ecriture")
  return ajouterContrepartieDans(ctx, agreementId, entree)
}

export type EntreeContrepartie = z.input<typeof schemaContrepartie>

export async function ajouterContrepartieDans(ctx: ContexteTeam, agreementId: string, entree: EntreeContrepartie): Promise<string> {
  const donnees = schemaContrepartie.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const convention = await conventionActiveDans(client, ctx, agreementId)
  if ((STATUTS_CLOS as readonly string[]).includes(convention.statut)) refus("Cette convention est close : on n'y ajoute plus de contrepartie.")

  let catalogue: { nom: string; type: (typeof TYPES_CONTREPARTIE)[number]; quantiteDefaut: number; unite: string } | null = null
  if (donnees.catalogId) {
    const entreeCatalogue = await client.partenairesBenefitCatalog.findFirst({
      where: { id: donnees.catalogId, teamId: ctx.teamId, deletedAt: null, actif: true },
      select: { nom: true, type: true, quantiteDefaut: true, unite: true },
    })
    if (!entreeCatalogue) refus("Contrepartie introuvable dans la liste de base.")
    catalogue = entreeCatalogue
  }

  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesBenefit.create({
      data: {
        id,
        teamId: ctx.teamId,
        agreementId,
        catalogId: donnees.catalogId ?? null,
        libelle: donnees.libelle || catalogue?.nom || "Contrepartie",
        type: donnees.type ?? catalogue?.type ?? "autre",
        quantitePromise: donnees.quantitePromise ?? catalogue?.quantiteDefaut ?? 1,
        quantiteTenue: 0,
        statut: "a_faire",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  return id
}

export async function modifierContrepartie(benefitId: string, entree: EntreeModifierContrepartie): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return modifierContrepartieDans(ctx, benefitId, entree)
}

export type EntreeModifierContrepartie = z.input<typeof schemaModifierContrepartie>

// Le lien avec un emplacement est un uuid sans clé étrangère (Voiture) : on garde le nom affiché avec.
export async function modifierContrepartieDans(ctx: ContexteTeam, benefitId: string, entree: EntreeModifierContrepartie): Promise<void> {
  const donnees = schemaModifierContrepartie.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const contrepartie = await contrepartieActiveDans(client, ctx, benefitId)
  if ((STATUTS_CLOS as readonly string[]).includes(contrepartie.agreement.statut)) refus("Cette convention est close : la contrepartie ne se modifie plus.")

  const champs: Record<string, unknown> = {}
  if (donnees.libelle !== undefined) champs.libelle = donnees.libelle
  if (donnees.type !== undefined) champs.type = donnees.type
  if (donnees.quantitePromise !== undefined) champs.quantitePromise = donnees.quantitePromise
  if (donnees.slotId !== undefined) champs.slotId = donnees.slotId
  if (donnees.slotNom !== undefined) champs.slotNom = donnees.slotId ? donnees.slotNom : null
  if (donnees.eventIds !== undefined) champs.eventIds = donnees.eventIds
  if (donnees.echeance !== undefined) champs.echeance = versJourOuNull(donnees.echeance)

  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesBenefit.update({ where: { id: benefitId }, data: { ...champs, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

// Saisit la quantité tenue. Le passage à « tenue » émet partenaires.contrepartie_tenue, une seule fois.
export async function saisirAvancement(benefitId: string, quantiteTenue: number): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return saisirAvancementDans(ctx, benefitId, quantiteTenue)
}

export async function saisirAvancementDans(ctx: ContexteTeam, benefitId: string, quantiteTenue: number): Promise<void> {
  const quantite = entier.parse(quantiteTenue)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const contrepartie = await contrepartieActiveDans(client, ctx, benefitId)
  if ((STATUTS_CLOS as readonly string[]).includes(contrepartie.agreement.statut)) refus("Cette convention est close : l'avancement ne se saisit plus.")

  const nouveau: StatutContrepartie = statutContrepartie({
    statut: contrepartie.statut,
    quantitePromise: contrepartie.quantitePromise,
    quantiteTenue: quantite,
    echeance: jourDe(contrepartie.echeance),
  })
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesBenefit.update({
      where: { id: benefitId },
      data: { quantiteTenue: quantite, statut: nouveau, rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )

  if (nouveau === "tenue" && contrepartie.statut !== "tenue") {
    await emettre(
      ctx,
      "partenaires.contrepartie_tenue",
      chargeContrepartieTenue.parse({
        agreementId: contrepartie.agreementId,
        partnerId: contrepartie.agreement.partnerId,
        benefitId,
        partenaireNom: contrepartie.agreement.partner.contact.nom,
        libelle: contrepartie.libelle,
      }),
    )
  }
}

export async function reporter(benefitId: string, echeance: string | null): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return reporterDans(ctx, benefitId, echeance)
}

export async function reporterDans(ctx: ContexteTeam, benefitId: string, echeance: string | null): Promise<void> {
  const donnees = jourCivil.nullable().parse(echeance)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await contrepartieActiveDans(client, ctx, benefitId)
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesBenefit.update({
      where: { id: benefitId },
      data: { statut: "reportee", echeance: versJourOuNull(donnees), rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )
}

// --- Preuves --------------------------------------------------------------------------------

export async function ajouterPreuve(benefitId: string, entree: EntreePreuve): Promise<string> {
  const { ctx } = await accesPartenaires("ecriture")
  return ajouterPreuveDans(ctx, benefitId, entree)
}

export type EntreePreuve = z.input<typeof schemaPreuve>

// Une preuve n'augmente pas la quantité tenue : c'est un geste distinct (saisirAvancement).
export async function ajouterPreuveDans(ctx: ContexteTeam, benefitId: string, entree: EntreePreuve): Promise<string> {
  const donnees = schemaPreuve.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await contrepartieActiveDans(client, ctx, benefitId)
  if (donnees.fileId) await fichierDeLEquipeDans(client, ctx, donnees.fileId)
  if (donnees.eventId) {
    const epreuve = await client.coreEvent.findFirst({ where: { id: donnees.eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!epreuve) refus("Épreuve introuvable dans cette team.")
  }

  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesProof.create({
      data: {
        id,
        teamId: ctx.teamId,
        benefitId,
        date: versJour(donnees.date),
        eventId: donnees.eventId ?? null,
        type: donnees.type,
        fileId: donnees.fileId ?? null,
        lien: donnees.lien ?? null,
        commentaire: donnees.commentaire || null,
        visiblePartenaire: donnees.visiblePartenaire ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    if (donnees.fileId) {
      await rattacherFichier(tx, ctx, { fileId: donnees.fileId, app: "partenaires", ficheType: "proof", ficheId: id, role: "preuve" })
    }
  })
  return id
}

// Preuve de pose (brief 3.8, §4) : une photo visible, datée du jour de la pose. La photo vient de Voiture : elle se
// rattache depuis l'occupation (source), et non par son envoyeur. Ne touche pas à la quantité tenue (voir saisirAvancement).
export async function ajouterPreuvePoseDans(
  ctx: ContexteTeam,
  benefitId: string,
  pose: { poseLe: string; fileId: string; source: FicheSource },
): Promise<string> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await contrepartieActiveDans(client, ctx, benefitId)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesProof.create({
      data: {
        id,
        teamId: ctx.teamId,
        benefitId,
        date: versJour(pose.poseLe),
        type: "photo",
        fileId: pose.fileId,
        visiblePartenaire: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await rattacherDepuisSource(tx, ctx, { fileId: pose.fileId, source: pose.source, cible: { app: "partenaires", ficheType: "proof", ficheId: id, role: "photo" } })
  })
  return id
}

export async function masquerPreuve(id: string, visible: boolean): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return masquerPreuveDans(ctx, id, visible)
}

export async function masquerPreuveDans(ctx: ContexteTeam, id: string, visible: boolean): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existe = await client.partenairesProof.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!existe) refus("Preuve introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesProof.update({ where: { id }, data: { visiblePartenaire: visible, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

export async function supprimerPreuve(id: string): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return supprimerPreuveDans(ctx, id)
}

export async function supprimerPreuveDans(ctx: ContexteTeam, id: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existe = await client.partenairesProof.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!existe) refus("Preuve introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesProof.update({ where: { id }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

// --- Liens de la page partenaire ------------------------------------------------------------

// Crée un lien et renvoie le jeton en clair, une seule fois : seule son empreinte est stockée.
// Le lien actif précédent est désactivé avant l'insertion (index unique partiel).
export async function creerLien(partnerId: string): Promise<{ lienId: string; jeton: string }> {
  const { ctx } = await accesPartenaires("gestion")
  return creerLienDans(ctx, partnerId)
}

export async function creerLienDans(ctx: ContexteTeam, partnerId: string): Promise<{ lienId: string; jeton: string }> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await partenaireActifDans(client, ctx, partnerId)
  const jeton = genererJeton()
  const lienId = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesPortalLink.updateMany({
      where: { teamId: ctx.teamId, partnerId, actif: true, deletedAt: null },
      data: { actif: false, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    await tx.partenairesPortalLink.create({
      data: {
        id: lienId,
        teamId: ctx.teamId,
        partnerId,
        jetonEmpreinte: empreinteJeton(jeton),
        actif: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  })
  return { lienId, jeton }
}

// Renouveler un lien, c'est créer un nouveau jeton : l'ancien ne fonctionne plus.
export async function renouvelerLien(partnerId: string): Promise<{ lienId: string; jeton: string }> {
  return creerLien(partnerId)
}

export async function revoquerLien(lienId: string): Promise<void> {
  const { ctx } = await accesPartenaires("gestion")
  return revoquerLienDans(ctx, lienId)
}

export async function revoquerLienDans(ctx: ContexteTeam, lienId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const lien = await client.partenairesPortalLink.findFirst({ where: { id: lienId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!lien) refus("Lien introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesPortalLink.update({ where: { id: lienId }, data: { actif: false, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

export async function modifierSections(lienId: string, sections: readonly string[]): Promise<void> {
  const { ctx } = await accesPartenaires("gestion")
  return modifierSectionsDans(ctx, lienId, sections)
}

export async function modifierSectionsDans(ctx: ContexteTeam, lienId: string, sections: readonly string[]): Promise<void> {
  const donnees = schemaSections.parse({ sections })
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const lien = await client.partenairesPortalLink.findFirst({ where: { id: lienId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!lien) refus("Lien introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesPortalLink.update({
      where: { id: lienId },
      data: { sections: donnees.sections, rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )
}

// --- Messages -------------------------------------------------------------------------------

export async function marquerLu(messageId: string): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return marquerLuDans(ctx, messageId)
}

export async function marquerLuDans(ctx: ContexteTeam, messageId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const message = await client.partenairesPortalMessage.findFirst({ where: { id: messageId, teamId: ctx.teamId, deletedAt: null }, select: { lueLe: true } })
  if (!message) refus("Message introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesPortalMessage.update({
      where: { id: messageId },
      data: { lueLe: message.lueLe ?? new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )
}

export async function marquerTraite(messageId: string, personneId: string | null): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return marquerTraiteDans(ctx, messageId, personneId)
}

export async function marquerTraiteDans(ctx: ContexteTeam, messageId: string, personneId: string | null): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const message = await client.partenairesPortalMessage.findFirst({ where: { id: messageId, teamId: ctx.teamId, deletedAt: null }, select: { lueLe: true } })
  if (!message) refus("Message introuvable.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.partenairesPortalMessage.update({
      where: { id: messageId },
      data: { traiteParPersonId: personneId, lueLe: message.lueLe ?? new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )
}

// --- Recalcul à l'ouverture du QG (appelé par src/apps/recalculs-qg.ts) ----------------------

export async function recalculerPourQg(ctx: ContexteTeam, niveau: Niveau): Promise<void> {
  if (niveau === "aucun") return
  await recalculerStatutsDans(ctx)
  await signalerContrepartiesEnRetardDans(ctx)
  await signalerRelancesDans(ctx)
}

// Passages automatiques : signée → en cours → terminée. Un partenaire sans convention signée ou en cours
// devient « ancien partenaire ».
export async function recalculerStatutsDans(ctx: ContexteTeam): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const aujourdhui = jourParis(new Date())
  const conventions = await client.partenairesAgreement.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, statut: { in: ["signee", "en_cours"] } },
    include: { partner: { include: { contact: { select: { nom: true } } } } },
  })

  for (const convention of conventions) {
    const dateDebut = jourDe(convention.dateDebut) ?? ""
    const dateFin = jourDe(convention.dateFin) ?? ""
    const nouveau: StatutConvention = statutAutomatique({ statut: convention.statut, dateDebut, dateFin }, aujourdhui)
    if (nouveau === convention.statut) continue
    await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.partenairesAgreement.update({ where: { id: convention.id }, data: { statut: nouveau, rev: { increment: 1 }, updatedBy: ctx.userId } }),
    )
    if (nouveau === "terminee") {
      await emettre(
        ctx,
        "partenaires.convention_terminee",
        chargeConventionTerminee.parse({
          agreementId: convention.id,
          partnerId: convention.partnerId,
          partenaireNom: convention.partner.contact.nom,
          motif: "terminee",
          slotIds: await emplacementsALiberer(client, ctx, convention),
        }),
      )
    }
  }

  const partenaires = await client.partenairesPartner.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, statut: "partenaire" },
    select: { id: true },
  })
  for (const partenaire of partenaires) {
    const encours = await client.partenairesAgreement.count({
      where: { teamId: ctx.teamId, partnerId: partenaire.id, deletedAt: null, statut: { in: ["signee", "en_cours"] } },
    })
    if (encours > 0) continue
    await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.partenairesPartner.update({ where: { id: partenaire.id }, data: { statut: "ancien_partenaire", rev: { increment: 1 }, updatedBy: ctx.userId } }),
    )
  }
}

// Une contrepartie en retard : un événement et une action, une seule fois par contrepartie et par échéance.
// L'action va au suivi du partenaire, ou aux responsables s'il n'y a pas de suivi.
export async function signalerContrepartiesEnRetardDans(ctx: ContexteTeam): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const aujourdhui = jourParis(new Date())
  const contreparties = await client.partenairesBenefit.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      echeance: { lt: versJour(aujourdhui) },
      statut: { notIn: ["tenue", "reportee"] },
      agreement: { deletedAt: null, statut: { notIn: ["brouillon", "envoyee", "resiliee"] } },
    },
    include: { agreement: { include: { partner: { include: { contact: { select: { nom: true } } } } } } },
  })

  for (const contrepartie of contreparties) {
    const echeance = jourDe(contrepartie.echeance)
    if (!echeance || !enRetard({ statut: contrepartie.statut, quantitePromise: contrepartie.quantitePromise, quantiteTenue: contrepartie.quantiteTenue, echeance }, aujourdhui)) continue
    const dejaEmis = await client.coreDomainEvent.findFirst({
      where: {
        teamId: ctx.teamId,
        nom: "partenaires.contrepartie_en_retard",
        AND: [{ donnees: { path: ["benefitId"], equals: contrepartie.id } }, { donnees: { path: ["echeance"], equals: echeance } }],
      },
      select: { id: true },
    })
    if (dejaEmis) continue

    const partenaire = contrepartie.agreement.partner
    const partenaireNom = partenaire.contact.nom
    await emettre(
      ctx,
      "partenaires.contrepartie_en_retard",
      chargeContrepartieEnRetard.parse({
        agreementId: contrepartie.agreementId,
        partnerId: partenaire.id,
        benefitId: contrepartie.id,
        partenaireNom,
        libelle: contrepartie.libelle,
        echeance,
      }),
    )
    const destinataires = await destinatairesDeSuiviDans(client, ctx, partenaire.suiviParPersonId)
    await emettre(ctx, "partenaires.action_requise", {
      type: "contrepartie_en_retard",
      cleUnicite: cleContrepartieEnRetard(contrepartie.id, echeance),
      titre: `Contrepartie en retard : ${contrepartie.libelle} (${partenaireNom})`,
      contexte: partenaireNom,
      ficheType: "partner",
      ficheId: partenaire.id,
      destinataires: { memberships: destinataires },
      boutons: [{ cle: "vu", libelle: "Vu" }],
      priorite: PRIORITE_CONTREPARTIE_EN_RETARD,
      niveauRequis: "ecriture",
      cleRegroupement: "contreparties_en_retard",
    })
  }
}

// Relance due : un événement et une tâche assignée au suivi, une seule fois par partenaire et par date.
export async function signalerRelancesDans(ctx: ContexteTeam): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const aujourdhui = jourParis(new Date())
  const partenaires = await client.partenairesPartner.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      prochaineRelance: { lte: versJour(aujourdhui) },
      statut: { notIn: ["partenaire", "ancien_partenaire", "refus"] },
    },
    include: { contact: { select: { nom: true } } },
  })

  for (const partenaire of partenaires) {
    const date = jourDe(partenaire.prochaineRelance)
    if (!date || !relanceDue({ statut: partenaire.statut, prochaineRelance: date }, aujourdhui)) continue
    const dejaEmis = await client.coreDomainEvent.findFirst({
      where: {
        teamId: ctx.teamId,
        nom: "partenaires.relance_due",
        AND: [{ donnees: { path: ["partnerId"], equals: partenaire.id } }, { donnees: { path: ["date"], equals: date } }],
      },
      select: { id: true },
    })
    if (dejaEmis) continue

    const partenaireNom = partenaire.contact.nom
    await emettre(ctx, "partenaires.relance_due", chargeRelanceDue.parse({ partnerId: partenaire.id, partenaireNom, date }))
    await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.coreTask.create({
        data: {
          id: newId(),
          teamId: ctx.teamId,
          app: "partenaires",
          ficheType: "partner",
          ficheId: partenaire.id,
          titre: `Relancer ${partenaireNom}`,
          assigneePersonId: partenaire.suiviParPersonId,
          echeance: partenaire.prochaineRelance,
          statut: "a_faire",
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      }),
    )
  }
}

// Destinataires d'une action : l'adhésion du suivi si elle existe, sinon les responsables actifs.
export async function destinatairesDeSuiviDans(client: Client, ctx: ContexteTeam, suiviParPersonId: string | null): Promise<string[]> {
  if (suiviParPersonId) {
    const adhesion = await client.coreMembership.findFirst({
      where: { teamId: ctx.teamId, personId: suiviParPersonId, statut: "actif", deletedAt: null },
      select: { id: true },
    })
    if (adhesion) return [adhesion.id]
  }
  const responsables = await client.coreMembership.findMany({
    where: { teamId: ctx.teamId, role: "responsable", statut: "actif", deletedAt: null },
    select: { id: true },
  })
  return responsables.map((membre) => membre.id)
}
