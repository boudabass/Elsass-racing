// Services serveur d'Équipe (tâche 5.1, brief §4). Même forme que Garage et Voiture : chaque fonction publique passe par
// accesEquipe(niveau) ; les fonctions « …Dans(ctx, …, niveau) » font le travail sans garde de session (gestionnaires,
// scripts). Droits : le niveau « écriture » ou plus gère le dossier de toute personne ; l'assistance (contribution) ne
// gère que le sien. Une lecture n'écrit jamais : le profil se crée à la première écriture (assurerProfilDans).
// Écritures concurrentes : avecReprisePourConflit. Les événements sont émis après l'écriture, jamais dedans.

import { z } from "zod"

import { jourDeParis } from "@/core/dates"
import type { ContexteTeam } from "@/core/contexte"
import { rattacherFichier } from "@/core/fichiers/fichiers-serveur"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { chargeLicencePayee } from "./charges"
import { ErreurEquipe, refus } from "./erreurs"
import {
  LIBELLES_TYPE_LICENCE,
  ROLES_HABITUELS,
  SPECIALITES,
  TYPES_EQUIPEMENT,
  TYPES_LICENCE,
  validiteCoherente,
  type TypeLicence,
} from "./regles"

export { ErreurEquipe }

// --- Accès ----------------------------------------------------------------------------------

export async function accesEquipe(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("equipe", requis)
  const ctx = { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } }
  return { ctx, niveau }
}

type Client = ReturnType<typeof prismaPourTeam>
type Tx = Parameters<Parameters<typeof executerPourTeam>[2]>[0]

// Personne liée au membre courant (son dossier propre). Null si le membre n'est pas encore lié à une personne.
export async function personneDuMembre(ctx: ContexteTeam): Promise<string | null> {
  const membre = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findFirst({
    where: { id: ctx.membership.id, teamId: ctx.teamId, deletedAt: null },
    select: { personId: true },
  })
  return membre?.personId ?? null
}

// Gérer le dossier d'une personne : le niveau écriture ou plus, ou le dossier propre (l'assistance).
async function exigerDossier(ctx: ContexteTeam, niveau: Niveau, personId: string): Promise<void> {
  if (aAuMoins(niveau, "ecriture")) return
  const propre = await personneDuMembre(ctx)
  if (propre !== personId) refus("Tu ne peux gérer que ton propre dossier.")
}

async function personneActiveDans(client: Client, ctx: ContexteTeam, personId: string): Promise<void> {
  const personne = await client.corePerson.findFirst({ where: { id: personId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!personne) refus("Personne introuvable dans cette team.")
}

// --- Schémas d'entrée -----------------------------------------------------------------------

const texte = (max: number) => z.string().trim().max(max).nullable().optional()
const identifiant = z.string().min(1)
const jourCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ.")

// Les dates sans heure sont en minuit UTC (colonnes @db.Date).
function versJour(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`)
}

// Une clé absente reste absente (écriture partielle) ; une clé nulle efface la valeur.
function jourOptionnel(jour: string | null | undefined): Date | null | undefined {
  if (jour === undefined) return undefined
  return jour ? versJour(jour) : null
}

// Ne garde que les champs renseignés : une modification partielle ne touche pas aux autres.
function renseignes<T extends Record<string, unknown>>(objet: T): Partial<T> {
  return Object.fromEntries(Object.entries(objet).filter(([, valeur]) => valeur !== undefined)) as Partial<T>
}

const schemaProfil = z
  .object({
    rolesHabituels: z.array(z.enum(ROLES_HABITUELS)).max(ROLES_HABITUELS.length).optional(),
    debutSportAuto: jourCivil.nullable().optional(),
    tailleVetements: texte(40),
    // Contact d'urgence seulement : aucune donnée médicale (955 §3).
    contactUrgence: texte(200),
    afficherTrophees: z.boolean().optional(),
  })
  .strict()

const baseLicence = {
  type: z.enum(TYPES_LICENCE),
  numero: texte(60),
  // Lien vers un contact de catégorie ASA (core_contact) : le service vérifie la catégorie.
  asaContactId: identifiant.nullable().optional(),
  saison: texte(20),
  valableDu: jourCivil.nullable().optional(),
  valableAu: jourCivil.nullable().optional(),
  documentFileId: identifiant.nullable().optional(),
  // Montant en centimes ; saisi = la licence est payée (Budget propose la dépense).
  montantCents: z.number().int().min(0).nullable().optional(),
  devise: z.literal("EUR").optional(),
}

const schemaLicence = z.object(baseLicence).strict()
const schemaModificationLicence = z.object(baseLicence).partial().strict()

const baseEquipement = {
  type: z.enum(TYPES_EQUIPEMENT),
  marque: texte(80),
  modele: texte(80),
  norme: texte(40),
  finHomologation: jourCivil.nullable().optional(),
  taille: texte(20),
  acheteLe: jourCivil.nullable().optional(),
  documentFileId: identifiant.nullable().optional(),
}

const schemaEquipement = z.object(baseEquipement).strict()
const schemaModificationEquipement = z.object(baseEquipement).partial().strict()

const baseSpecialite = {
  specialite: z.enum(SPECIALITES),
  // Niveau déclaré, entier de 1 à 5, facultatif.
  niveauDeclare: z.number().int().min(1).max(5).nullable().optional(),
  formation: texte(200),
  dateFormation: jourCivil.nullable().optional(),
  justificatifFileId: identifiant.nullable().optional(),
}

const schemaSpecialite = z.object(baseSpecialite).strict()
const schemaModificationSpecialite = z.object(baseSpecialite).partial().strict()

export type EntreeProfil = z.input<typeof schemaProfil>
export type EntreeLicence = z.input<typeof schemaLicence>
export type EntreeEquipement = z.input<typeof schemaEquipement>
export type EntreeSpecialite = z.input<typeof schemaSpecialite>

// --- Profil ---------------------------------------------------------------------------------

// Profil de la personne, créé à la première écriture (une lecture ne crée rien). Une seule ligne active par personne :
// l'index partiel de la migration le garantit, et skipDuplicates absorbe la course entre deux créations.
export async function assurerProfilDans(ctx: ContexteTeam, personId: string): Promise<string> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existant = await client.equipeProfile.findFirst({ where: { teamId: ctx.teamId, personId, deletedAt: null }, select: { id: true } })
  if (existant) return existant.id
  await personneActiveDans(client, ctx, personId)
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.equipeProfile.createMany({
        skipDuplicates: true,
        data: [{ id: newId(), teamId: ctx.teamId, personId, createdBy: ctx.userId, updatedBy: ctx.userId }],
      }),
    ),
  )
  const cree = await client.equipeProfile.findFirst({ where: { teamId: ctx.teamId, personId, deletedAt: null }, select: { id: true } })
  if (!cree) refus("Profil introuvable.")
  return cree.id
}

export async function modifierProfil(personId: string, entree: EntreeProfil): Promise<void> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return modifierProfilDans(ctx, personId, entree, niveau)
}

export async function modifierProfilDans(ctx: ContexteTeam, personId: string, entree: EntreeProfil, niveau: Niveau): Promise<void> {
  const donnees = schemaProfil.parse(entree)
  await exigerDossier(ctx, niveau, personId)
  const profilId = await assurerProfilDans(ctx, personId)
  const modifs = renseignes({
    rolesHabituels: donnees.rolesHabituels,
    debutSportAuto: jourOptionnel(donnees.debutSportAuto),
    tailleVetements: donnees.tailleVetements,
    contactUrgence: donnees.contactUrgence,
    afficherTrophees: donnees.afficherTrophees,
  })
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.equipeProfile.update({ where: { id: profilId }, data: { ...modifs, rev: { increment: 1 }, updatedBy: ctx.userId } }),
    ),
  )
}

// --- Licences -------------------------------------------------------------------------------

// Un contact d'ASA est un contact de catégorie « asa » de la team. Sinon, refus : pas de numéro d'ASA en clair.
async function verifierContactAsa(client: Client, ctx: ContexteTeam, contactId: string | null | undefined): Promise<void> {
  if (!contactId) return
  const contact = await client.coreContact.findFirst({
    where: { id: contactId, teamId: ctx.teamId, deletedAt: null, categories: { has: "asa" } },
    select: { id: true },
  })
  if (!contact) refus("Ce contact n'est pas une ASA de la team.")
}

function verifierValidite(valableDu: string | null | undefined, valableAu: string | null | undefined): void {
  if (!validiteCoherente(valableDu, valableAu)) refus("La fin de validité ne peut pas être avant le début.")
}

// Rattache le document d'une fiche et renvoie l'id de sa pièce jointe (colonne document_attachment_id).
async function attacherDocumentDans(tx: Tx, ctx: ContexteTeam, fileId: string, ficheType: string, ficheId: string): Promise<string | null> {
  await rattacherFichier(tx, ctx, { fileId, app: "equipe", ficheType, ficheId, role: "document" })
  const piece = await tx.coreAttachment.findFirst({
    where: { teamId: ctx.teamId, fileId, app: "equipe", ficheType, ficheId, deletedAt: null },
    select: { id: true },
  })
  return piece?.id ?? null
}

async function licenceActiveDans(client: Client, ctx: ContexteTeam, id: string) {
  const licence = await client.equipeLicence.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!licence) refus("Licence introuvable.")
  return licence
}

export async function ajouterLicence(personId: string, entree: EntreeLicence): Promise<string> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return ajouterLicenceDans(ctx, personId, entree, niveau)
}

export async function ajouterLicenceDans(ctx: ContexteTeam, personId: string, entree: EntreeLicence, niveau: Niveau): Promise<string> {
  const donnees = schemaLicence.parse(entree)
  await exigerDossier(ctx, niveau, personId)
  verifierValidite(donnees.valableDu, donnees.valableAu)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await personneActiveDans(client, ctx, personId)
  await verifierContactAsa(client, ctx, donnees.asaContactId)

  const id = newId()
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.equipeLicence.create({
        data: {
          id,
          teamId: ctx.teamId,
          personId,
          type: donnees.type,
          numero: donnees.numero ?? null,
          asaContactId: donnees.asaContactId ?? null,
          saison: donnees.saison ?? null,
          valableDu: jourOptionnel(donnees.valableDu) ?? null,
          valableAu: jourOptionnel(donnees.valableAu) ?? null,
          montantCents: donnees.montantCents ?? null,
          devise: "EUR",
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      if (donnees.documentFileId) {
        const pieceId = await attacherDocumentDans(tx, ctx, donnees.documentFileId, "licence", id)
        await tx.equipeLicence.update({ where: { id }, data: { documentAttachmentId: pieceId } })
      }
    }),
  )
  if (donnees.montantCents && donnees.montantCents > 0) await emettrePaiementLicence(ctx, id, personId, donnees.type, donnees.montantCents)
  return id
}

export async function modifierLicence(id: string, entree: EntreeLicence): Promise<void> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return modifierLicenceDans(ctx, id, entree, niveau)
}

export async function modifierLicenceDans(ctx: ContexteTeam, id: string, entree: EntreeLicence, niveau: Niveau): Promise<void> {
  const donnees = schemaModificationLicence.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await licenceActiveDans(client, ctx, id)
  await exigerDossier(ctx, niveau, avant.personId)
  verifierValidite(valeurFinale(donnees.valableDu, jourDe(avant.valableDu)), valeurFinale(donnees.valableAu, jourDe(avant.valableAu)))
  await verifierContactAsa(client, ctx, donnees.asaContactId)

  const modifs = renseignes({
    type: donnees.type,
    numero: donnees.numero,
    asaContactId: donnees.asaContactId,
    saison: donnees.saison,
    valableDu: jourOptionnel(donnees.valableDu),
    valableAu: jourOptionnel(donnees.valableAu),
    montantCents: donnees.montantCents,
  })
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.equipeLicence.update({ where: { id }, data: { ...modifs, rev: { increment: 1 }, updatedBy: ctx.userId } })
      if (donnees.documentFileId) {
        const pieceId = await attacherDocumentDans(tx, ctx, donnees.documentFileId, "licence", id)
        await tx.equipeLicence.update({ where: { id }, data: { documentAttachmentId: pieceId } })
      }
    }),
  )

  // Un montant saisi pour la première fois : la licence est payée, Budget propose la dépense. Une correction ultérieure
  // du montant ne propose rien de plus (la dépense déjà proposée n'est pas modifiée par Équipe).
  const montantAvant = avant.montantCents ?? 0
  const montantApres = donnees.montantCents ?? montantAvant
  if (montantAvant === 0 && montantApres > 0) {
    await emettrePaiementLicence(ctx, id, avant.personId, donnees.type ?? avant.type, montantApres)
  }
}

export async function retirerLicence(id: string): Promise<void> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return retirerLicenceDans(ctx, id, niveau)
}

export async function retirerLicenceDans(ctx: ContexteTeam, id: string, niveau: Niveau): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await licenceActiveDans(client, ctx, id)
  await exigerDossier(ctx, niveau, avant.personId)
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.equipeLicence.update({ where: { id }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
    ),
  )
}

async function emettrePaiementLicence(ctx: ContexteTeam, licenceId: string, personId: string, type: TypeLicence, montantCents: number): Promise<void> {
  await emettre(
    ctx,
    "equipe.licence_payee",
    chargeLicencePayee.parse({
      licenceId,
      personId,
      libelle: LIBELLES_TYPE_LICENCE[type],
      montantCents,
      devise: "EUR",
      date: jourDeParis(new Date()),
    }),
  )
}

// Valeur après modification : la saisie si elle est donnée (même nulle), sinon la valeur déjà enregistrée.
function valeurFinale<T>(saisie: T | undefined, existante: T): T {
  return saisie === undefined ? existante : saisie
}

function jourDe(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

// --- Équipements ----------------------------------------------------------------------------

async function equipementActifDans(client: Client, ctx: ContexteTeam, id: string) {
  const equipement = await client.equipeGear.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!equipement) refus("Équipement introuvable.")
  return equipement
}

export async function ajouterEquipement(personId: string, entree: EntreeEquipement): Promise<string> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return ajouterEquipementDans(ctx, personId, entree, niveau)
}

export async function ajouterEquipementDans(ctx: ContexteTeam, personId: string, entree: EntreeEquipement, niveau: Niveau): Promise<string> {
  const donnees = schemaEquipement.parse(entree)
  await exigerDossier(ctx, niveau, personId)
  await personneActiveDans(prismaPourTeam(ctx.teamId, ctx.userId), ctx, personId)
  const id = newId()
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.equipeGear.create({
        data: {
          id,
          teamId: ctx.teamId,
          personId,
          type: donnees.type,
          marque: donnees.marque ?? null,
          modele: donnees.modele ?? null,
          norme: donnees.norme ?? null,
          finHomologation: jourOptionnel(donnees.finHomologation) ?? null,
          taille: donnees.taille ?? null,
          acheteLe: jourOptionnel(donnees.acheteLe) ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      if (donnees.documentFileId) {
        const pieceId = await attacherDocumentDans(tx, ctx, donnees.documentFileId, "gear", id)
        await tx.equipeGear.update({ where: { id }, data: { documentAttachmentId: pieceId } })
      }
    }),
  )
  return id
}

export async function modifierEquipement(id: string, entree: EntreeEquipement): Promise<void> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return modifierEquipementDans(ctx, id, entree, niveau)
}

export async function modifierEquipementDans(ctx: ContexteTeam, id: string, entree: EntreeEquipement, niveau: Niveau): Promise<void> {
  const donnees = schemaModificationEquipement.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await equipementActifDans(client, ctx, id)
  await exigerDossier(ctx, niveau, avant.personId)
  const modifs = renseignes({
    type: donnees.type,
    marque: donnees.marque,
    modele: donnees.modele,
    norme: donnees.norme,
    finHomologation: jourOptionnel(donnees.finHomologation),
    taille: donnees.taille,
    acheteLe: jourOptionnel(donnees.acheteLe),
  })
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.equipeGear.update({ where: { id }, data: { ...modifs, rev: { increment: 1 }, updatedBy: ctx.userId } })
      if (donnees.documentFileId) {
        const pieceId = await attacherDocumentDans(tx, ctx, donnees.documentFileId, "gear", id)
        await tx.equipeGear.update({ where: { id }, data: { documentAttachmentId: pieceId } })
      }
    }),
  )
}

export async function retirerEquipement(id: string): Promise<void> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return retirerEquipementDans(ctx, id, niveau)
}

export async function retirerEquipementDans(ctx: ContexteTeam, id: string, niveau: Niveau): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await equipementActifDans(client, ctx, id)
  await exigerDossier(ctx, niveau, avant.personId)
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.equipeGear.update({ where: { id }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
    ),
  )
}

// --- Spécialités ----------------------------------------------------------------------------

async function specialiteActiveDans(client: Client, ctx: ContexteTeam, id: string) {
  const specialite = await client.equipeSkill.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!specialite) refus("Spécialité introuvable.")
  return specialite
}

export async function ajouterSpecialite(personId: string, entree: EntreeSpecialite): Promise<string> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return ajouterSpecialiteDans(ctx, personId, entree, niveau)
}

export async function ajouterSpecialiteDans(ctx: ContexteTeam, personId: string, entree: EntreeSpecialite, niveau: Niveau): Promise<string> {
  const donnees = schemaSpecialite.parse(entree)
  await exigerDossier(ctx, niveau, personId)
  await personneActiveDans(prismaPourTeam(ctx.teamId, ctx.userId), ctx, personId)
  const id = newId()
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.equipeSkill.create({
        data: {
          id,
          teamId: ctx.teamId,
          personId,
          specialite: donnees.specialite,
          niveauDeclare: donnees.niveauDeclare ?? null,
          formation: donnees.formation ?? null,
          dateFormation: jourOptionnel(donnees.dateFormation) ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      if (donnees.justificatifFileId) {
        const pieceId = await attacherDocumentDans(tx, ctx, donnees.justificatifFileId, "skill", id)
        await tx.equipeSkill.update({ where: { id }, data: { justificatifAttachmentId: pieceId } })
      }
    }),
  )
  return id
}

export async function modifierSpecialite(id: string, entree: EntreeSpecialite): Promise<void> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return modifierSpecialiteDans(ctx, id, entree, niveau)
}

export async function modifierSpecialiteDans(ctx: ContexteTeam, id: string, entree: EntreeSpecialite, niveau: Niveau): Promise<void> {
  const donnees = schemaModificationSpecialite.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await specialiteActiveDans(client, ctx, id)
  await exigerDossier(ctx, niveau, avant.personId)
  const modifs = renseignes({
    specialite: donnees.specialite,
    niveauDeclare: donnees.niveauDeclare,
    formation: donnees.formation,
    dateFormation: jourOptionnel(donnees.dateFormation),
  })
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.equipeSkill.update({ where: { id }, data: { ...modifs, rev: { increment: 1 }, updatedBy: ctx.userId } })
      if (donnees.justificatifFileId) {
        const pieceId = await attacherDocumentDans(tx, ctx, donnees.justificatifFileId, "skill", id)
        await tx.equipeSkill.update({ where: { id }, data: { justificatifAttachmentId: pieceId } })
      }
    }),
  )
}

export async function retirerSpecialite(id: string): Promise<void> {
  const { ctx, niveau } = await accesEquipe("contribution")
  return retirerSpecialiteDans(ctx, id, niveau)
}

export async function retirerSpecialiteDans(ctx: ContexteTeam, id: string, niveau: Niveau): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await specialiteActiveDans(client, ctx, id)
  await exigerDossier(ctx, niveau, avant.personId)
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.equipeSkill.update({ where: { id }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
    ),
  )
}
