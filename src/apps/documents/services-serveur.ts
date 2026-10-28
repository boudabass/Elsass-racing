// Services serveur de Documents (tâche 5.3, brief §4). Chaque fonction publique passe par accesDocuments(niveau) puis
// par une décision des règles pures (regles.ts) : un refus porte sa raison, en français, tutoiement. Une lecture n'écrit
// jamais. Les sept dossiers types sont créés à la première écriture de la team, dans la même transaction, sans doublon
// (contrainte unique partielle + ON CONFLICT DO NOTHING). Les événements sont émis après l'écriture, jamais dedans.

import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { exigerAcces } from "@/core/droits/garde-serveur"
import type { Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { rattacherFichier } from "@/core/fichiers/fichiers-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { chargeDocumentAjoute, chargeReglementPublie } from "./charges"
import { ErreurDocuments, refus } from "./erreurs"
import {
  DOSSIERS_TYPES,
  dossierTypeParCle,
  nombreAttenduDossierType,
  numeroVersionSuivant,
  peutAjouterDocument,
  peutArchiverDocument,
  peutDeplacerDocument,
  peutGererDossier,
  peutModifierDocument,
  peutPartagerDocument,
  peutVoirDossier,
  TYPES_DOCUMENT,
  VISIBILITES,
  type Decision,
  type DocumentPourDroits,
  type DossierPourDroits,
  type NiveauAcces,
  type QuiAgit,
  type Visibilite,
} from "./regles"

export { ErreurDocuments }

// --- Accès ----------------------------------------------------------------------------------

export async function accesDocuments(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("documents", requis)
  const ctx = { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } }
  return { ctx, niveau }
}

type Client = ReturnType<typeof prismaPourTeam>
type Tx = Parameters<Parameters<typeof executerPourTeam>[2]>[0]

// Personne liée au membre courant. Null si le compte n'a pas encore de fiche personne : il peut alors agir selon son
// niveau, mais ne possède aucun document.
export async function personneDuMembre(ctx: ContexteTeam): Promise<string | null> {
  const membre = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findFirst({
    where: { id: ctx.membership.id, teamId: ctx.teamId, deletedAt: null },
    select: { personId: true },
  })
  return membre?.personId ?? null
}

async function quiAgit(ctx: ContexteTeam, niveau: Niveau): Promise<QuiAgit> {
  return { personId: await personneDuMembre(ctx), niveau: niveau as QuiAgit["niveau"] }
}

// Un refus de règle devient une erreur métier, avec sa raison.
export function gardeDe(decision: Decision): void {
  if (!decision.permis) refus(decision.raison)
}

// --- Schémas d'entrée -----------------------------------------------------------------------

const texte = (max: number) => z.string().trim().max(max).nullable().optional()
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

const schemaChampsDocument = {
  titre: z.string().trim().min(1, "Donne un titre au document.").max(160),
  typeDocument: z.enum(TYPES_DOCUMENT, { message: "Choisis un type de document." }),
  reference: texte(120),
  dateEmission: jourCivil.nullable().optional(),
  dateValidite: jourCivil.nullable().optional(),
  notes: texte(2000),
  visibilite: z.enum(VISIBILITES).optional(),
}

const schemaDocument = z.object({
  ...schemaChampsDocument,
  // Le dossier : la clé d'un dossier type (« association »), ou l'identifiant d'un dossier de la team.
  dossier: z.string().min(1, "Choisis un dossier."),
  fichierId: z.string().min(1).nullable().optional(),
  commentaire: texte(300),
})

const schemaModificationDocument = z.object(schemaChampsDocument).partial()

const schemaDossier = z.object({
  nom: z.string().trim().min(1, "Donne un nom au dossier.").max(80),
  visibilite: z.enum(VISIBILITES).optional(),
})

export type EntreeDocument = z.input<typeof schemaDocument>
export type EntreeModificationDocument = z.input<typeof schemaModificationDocument>
export type EntreeDossier = z.input<typeof schemaDossier>

function verifierDates(emission: Date | null | undefined, validite: Date | null | undefined): void {
  if (emission && validite && validite.getTime() < emission.getTime()) {
    refus("La date de validité doit être après la date d'émission.")
  }
}

// --- Dossiers types : création paresseuse -----------------------------------------------------

// Les sept dossiers types de la team, s'ils manquent. Appelée au début de chaque écriture, dans la même transaction.
async function assurerDossiersTypes(tx: Tx, ctx: ContexteTeam): Promise<void> {
  const existants = await tx.documentsFolder.findMany({
    where: { teamId: ctx.teamId, kind: "systeme", deletedAt: null },
    select: { name: true },
  })
  const manquants = DOSSIERS_TYPES.filter((dossier) => !existants.some((existant) => existant.name === dossier.nom))
  if (manquants.length === 0) return

  await tx.documentsFolder.createMany({
    data: manquants.map((dossier) => ({
      id: newId(),
      teamId: ctx.teamId,
      name: dossier.nom,
      kind: "systeme" as const,
      sort: DOSSIERS_TYPES.indexOf(dossier),
      expectedCount: nombreAttenduDossierType(dossier),
      visibility: "team" as const,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })),
    skipDuplicates: true,
  })
}

// Écriture de Documents : reprise sur conflit, dossiers types assurés dans la même transaction.
async function ecrire<T>(ctx: ContexteTeam, operation: (tx: Tx) => Promise<T>): Promise<T> {
  return avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await assurerDossiersTypes(tx, ctx)
      return operation(tx)
    }),
  )
}

// --- Lectures internes à l'écriture ------------------------------------------------------------

const SELECT_DOSSIER = { id: true, name: true, kind: true, visibility: true, ownerPersonId: true } as const

// Un dossier, par sa clé de dossier type ou par son identifiant. Refus s'il n'existe pas.
async function dossierDe(tx: Tx, ctx: ContexteTeam, cle: string) {
  const type = dossierTypeParCle(cle)
  const dossier = type
    ? await tx.documentsFolder.findFirst({ where: { teamId: ctx.teamId, kind: "systeme", name: type.nom, deletedAt: null }, select: SELECT_DOSSIER })
    : await tx.documentsFolder.findFirst({ where: { id: cle, teamId: ctx.teamId, deletedAt: null }, select: SELECT_DOSSIER })
  if (!dossier) refus("Dossier introuvable.")
  return dossier
}

function dossierPourDroits(dossier: { ownerPersonId: string | null; visibility: string }): DossierPourDroits {
  return { ownerPersonId: dossier.ownerPersonId, visibility: dossier.visibility as Visibilite }
}

// Accès interne actif de la personne qui agit sur ce document, null sans accès.
async function accesDe(tx: Tx, ctx: ContexteTeam, docId: string, personId: string | null): Promise<NiveauAcces | null> {
  if (!personId) return null
  const acces = await tx.documentsAccess.findFirst({
    where: { teamId: ctx.teamId, docId, personId, deletedAt: null },
    select: { level: true },
  })
  return (acces?.level as NiveauAcces | undefined) ?? null
}

const SELECT_DOCUMENT = {
  id: true,
  folderId: true,
  title: true,
  docType: true,
  reference: true,
  issuedOn: true,
  validUntil: true,
  notes: true,
  status: true,
  visibility: true,
  ownerPersonId: true,
  currentVersionId: true,
  folder: { select: SELECT_DOSSIER },
} as const

// Un document visible ou non, avec son dossier. Refus s'il n'existe pas dans cette team.
async function documentDans(tx: Tx, ctx: ContexteTeam, id: string) {
  const doc = await tx.documentsDoc.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: SELECT_DOCUMENT })
  if (!doc) refus("Document introuvable.")
  return doc
}

function documentPourDroits(doc: { ownerPersonId: string | null; visibility: string }, acces: NiveauAcces | null): DocumentPourDroits {
  return { ownerPersonId: doc.ownerPersonId, visibility: doc.visibility as Visibilite, accesPersonne: acces }
}

// Version suivante et rattachement du fichier, dans la transaction. L'ordre est celui de la décision validée :
// id de la version, rattachement (fiche documents_version), puis insertion de la version avec attachment_id.
async function ajouterVersionDans(tx: Tx, ctx: ContexteTeam, docId: string, fichierId: string, personId: string | null, commentaire: string | null) {
  const versionId = newId()
  const attachmentId = await rattacherFichier(tx, ctx, {
    fileId: fichierId,
    app: "documents",
    ficheType: "documents_version",
    ficheId: versionId,
    role: "document",
  })
  const existantes = await tx.documentsVersion.findMany({ where: { teamId: ctx.teamId, docId }, select: { versionNo: true } })
  await tx.documentsVersion.create({
    data: {
      id: versionId,
      teamId: ctx.teamId,
      docId,
      versionNo: numeroVersionSuivant(existantes.map((version) => version.versionNo)),
      attachmentId,
      uploadedBy: personId,
      comment: commentaire ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  })
  await tx.documentsDoc.update({ where: { id: docId }, data: { currentVersionId: versionId, updatedBy: ctx.userId } })
  return versionId
}

// --- Dossiers ----------------------------------------------------------------------------------

export async function creerDossier(entree: EntreeDossier): Promise<string> {
  const donnees = schemaDossier.parse(entree)
  const { ctx, niveau } = await accesDocuments("ecriture")
  gardeDe(peutGererDossier(await quiAgit(ctx, niveau)))
  const id = newId()
  await ecrire(ctx, async (tx) => {
    const homonyme = await tx.documentsFolder.findFirst({ where: { teamId: ctx.teamId, name: donnees.nom, deletedAt: null }, select: { id: true } })
    if (homonyme) refus("Un dossier porte déjà ce nom.")
    await tx.documentsFolder.create({
      data: {
        id,
        teamId: ctx.teamId,
        name: donnees.nom,
        kind: "perso",
        visibility: donnees.visibilite ?? "team",
        ownerPersonId: null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  })
  return id
}

export async function modifierDossier(id: string, entree: EntreeDossier): Promise<void> {
  const donnees = schemaDossier.partial().parse(entree)
  const { ctx, niveau } = await accesDocuments("ecriture")
  gardeDe(peutGererDossier(await quiAgit(ctx, niveau)))
  await ecrire(ctx, async (tx) => {
    const dossier = await dossierDe(tx, ctx, id)
    // Un dossier type ne se renomme pas (brief §1) ; sa visibilité reste réglable.
    const renomme = donnees.nom !== undefined && donnees.nom !== dossier.name
    if (renomme && dossier.kind === "systeme") refus("Un dossier type ne se renomme pas.")
    if (renomme) {
      const homonyme = await tx.documentsFolder.findFirst({ where: { teamId: ctx.teamId, name: donnees.nom, deletedAt: null }, select: { id: true } })
      if (homonyme) refus("Un dossier porte déjà ce nom.")
    }
    await tx.documentsFolder.update({
      where: { id: dossier.id },
      data: { name: donnees.nom ?? dossier.name, visibility: donnees.visibilite ?? dossier.visibility, updatedBy: ctx.userId },
    })
  })
}

export async function supprimerDossier(id: string): Promise<void> {
  const { ctx, niveau } = await accesDocuments("ecriture")
  gardeDe(peutGererDossier(await quiAgit(ctx, niveau)))
  await ecrire(ctx, async (tx) => {
    const dossier = await dossierDe(tx, ctx, id)
    if (dossier.kind === "systeme") refus("Un dossier type ne se supprime pas.")
    const contenus = await tx.documentsDoc.count({ where: { teamId: ctx.teamId, folderId: dossier.id, deletedAt: null } })
    if (contenus > 0) refus("Le dossier n'est pas vide : déplace ses documents avant de le supprimer.")
    await tx.documentsFolder.update({ where: { id: dossier.id }, data: { deletedAt: new Date(), updatedBy: ctx.userId, rev: { increment: 1 } } })
  })
}

// --- Documents ---------------------------------------------------------------------------------

export async function creerDocument(entree: EntreeDocument): Promise<string> {
  const donnees = schemaDocument.parse(entree)
  verifierDates(jourOptionnel(donnees.dateEmission), jourOptionnel(donnees.dateValidite))
  const { ctx, niveau } = await accesDocuments("contribution")
  const qui = await quiAgit(ctx, niveau)
  gardeDe(peutAjouterDocument(qui))

  const id = newId()
  await ecrire(ctx, async (tx) => {
    const dossier = await dossierDe(tx, ctx, donnees.dossier)
    // On ne range pas dans un dossier qu'on ne voit pas (l'assistance, en particulier).
    if (!peutVoirDossier(dossierPourDroits(dossier), qui)) refus("Tu ne vois pas ce dossier.")

    await tx.documentsDoc.create({
      data: {
        id,
        teamId: ctx.teamId,
        folderId: dossier.id,
        title: donnees.titre,
        docType: donnees.typeDocument,
        reference: donnees.reference ?? null,
        issuedOn: jourOptionnel(donnees.dateEmission) ?? null,
        validUntil: jourOptionnel(donnees.dateValidite) ?? null,
        notes: donnees.notes ?? null,
        status: "actif",
        visibility: donnees.visibilite ?? "team",
        ownerPersonId: qui.personId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    if (donnees.fichierId) await ajouterVersionDans(tx, ctx, id, donnees.fichierId, qui.personId, donnees.commentaire ?? null)
  })

  // Événements après l'écriture : document ajouté ; règlement publié en plus pour un règlement, jamais à une nouvelle version.
  const charge = { documentId: id, titre: donnees.titre, typeDocument: donnees.typeDocument }
  await emettre(ctx, "documents.document_ajoute", chargeDocumentAjoute.parse(charge))
  if (donnees.typeDocument === "reglement_ffsa" || donnees.typeDocument === "reglement_particulier") {
    await emettre(ctx, "documents.reglement_publie", chargeReglementPublie.parse(charge))
  }
  return id
}

export async function modifierDocument(id: string, entree: EntreeModificationDocument): Promise<void> {
  const donnees = schemaModificationDocument.parse(entree)
  const { ctx, niveau } = await accesDocuments("contribution")
  const qui = await quiAgit(ctx, niveau)
  await ecrire(ctx, async (tx) => {
    const doc = await documentDans(tx, ctx, id)
    const acces = await accesDe(tx, ctx, id, qui.personId)
    gardeDe(peutModifierDocument(documentPourDroits(doc, acces), dossierPourDroits(doc.folder), qui))
    verifierDates(
      jourOptionnel(donnees.dateEmission) !== undefined ? jourOptionnel(donnees.dateEmission) : doc.issuedOn,
      jourOptionnel(donnees.dateValidite) !== undefined ? jourOptionnel(donnees.dateValidite) : doc.validUntil,
    )
    await tx.documentsDoc.update({
      where: { id: doc.id },
      data: {
        title: donnees.titre ?? doc.title,
        docType: donnees.typeDocument ?? doc.docType,
        reference: donnees.reference !== undefined ? donnees.reference : doc.reference,
        issuedOn: jourOptionnel(donnees.dateEmission) !== undefined ? jourOptionnel(donnees.dateEmission) : doc.issuedOn,
        validUntil: jourOptionnel(donnees.dateValidite) !== undefined ? jourOptionnel(donnees.dateValidite) : doc.validUntil,
        notes: donnees.notes !== undefined ? donnees.notes : doc.notes,
        visibility: donnees.visibilite ?? doc.visibility,
        updatedBy: ctx.userId,
      },
    })
  })
}

// « Remplacer le fichier » et « Ajouter un fichier » : une nouvelle version, l'ancienne reste dans l'historique.
export async function ajouterVersion(docId: string, fichierId: string, commentaire?: string | null): Promise<string> {
  const { ctx, niveau } = await accesDocuments("contribution")
  const qui = await quiAgit(ctx, niveau)
  return ecrire(ctx, async (tx) => {
    const doc = await documentDans(tx, ctx, docId)
    const acces = await accesDe(tx, ctx, docId, qui.personId)
    gardeDe(peutModifierDocument(documentPourDroits(doc, acces), dossierPourDroits(doc.folder), qui))
    return ajouterVersionDans(tx, ctx, docId, fichierId, qui.personId, commentaire ?? null)
  })
}

export async function deplacerDocument(docId: string, dossierCle: string): Promise<void> {
  const { ctx, niveau } = await accesDocuments("ecriture")
  const qui = await quiAgit(ctx, niveau)
  await ecrire(ctx, async (tx) => {
    const doc = await documentDans(tx, ctx, docId)
    const acces = await accesDe(tx, ctx, docId, qui.personId)
    gardeDe(peutDeplacerDocument(documentPourDroits(doc, acces), dossierPourDroits(doc.folder), qui))
    const cible = await dossierDe(tx, ctx, dossierCle)
    if (!peutVoirDossier(dossierPourDroits(cible), qui)) refus("Tu ne vois pas ce dossier.")
    await tx.documentsDoc.update({ where: { id: doc.id }, data: { folderId: cible.id, updatedBy: ctx.userId } })
  })
}

async function changerStatut(docId: string, statut: "actif" | "archive"): Promise<void> {
  const { ctx, niveau } = await accesDocuments("ecriture")
  const qui = await quiAgit(ctx, niveau)
  await ecrire(ctx, async (tx) => {
    const doc = await documentDans(tx, ctx, docId)
    const acces = await accesDe(tx, ctx, docId, qui.personId)
    const droits = documentPourDroits(doc, acces)
    gardeDe(statut === "archive" ? peutArchiverDocument(droits, dossierPourDroits(doc.folder), qui) : peutModifierDocument(droits, dossierPourDroits(doc.folder), qui))
    await tx.documentsDoc.update({ where: { id: doc.id }, data: { status: statut, updatedBy: ctx.userId } })
  })
}

export async function archiverDocument(docId: string): Promise<void> {
  return changerStatut(docId, "archive")
}

export async function remettreEnService(docId: string): Promise<void> {
  return changerStatut(docId, "actif")
}

// --- Partage interne ---------------------------------------------------------------------------

export async function partagerDocument(docId: string, personId: string, niveau: NiveauAcces): Promise<void> {
  const { ctx, niveau: niveauActeur } = await accesDocuments("ecriture")
  const qui = await quiAgit(ctx, niveauActeur)
  await ecrire(ctx, async (tx) => {
    const doc = await documentDans(tx, ctx, docId)
    const acces = await accesDe(tx, ctx, docId, qui.personId)
    gardeDe(peutPartagerDocument(documentPourDroits(doc, acces), dossierPourDroits(doc.folder), qui))
    // La personne doit avoir un compte actif dans la team : sans compte, rien à ouvrir.
    const personne = await tx.corePerson.findFirst({
      where: { id: personId, teamId: ctx.teamId, deletedAt: null, userId: { not: null } },
      select: { id: true },
    })
    if (!personne) refus("Cette personne n'a pas de compte actif dans la team.")

    const existant = await tx.documentsAccess.findFirst({
      where: { teamId: ctx.teamId, docId, personId, deletedAt: null },
      select: { id: true },
    })
    if (existant) {
      await tx.documentsAccess.update({ where: { id: existant.id }, data: { level: niveau, updatedBy: ctx.userId } })
      return
    }
    await tx.documentsAccess.create({
      data: { id: newId(), teamId: ctx.teamId, docId, personId, level: niveau, grantedBy: qui.personId, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
  })
}

export async function retirerAcces(accesId: string): Promise<void> {
  const { ctx, niveau } = await accesDocuments("ecriture")
  const qui = await quiAgit(ctx, niveau)
  await ecrire(ctx, async (tx) => {
    const acces = await tx.documentsAccess.findFirst({ where: { id: accesId, teamId: ctx.teamId, deletedAt: null }, select: { docId: true } })
    if (!acces) refus("Accès introuvable.")
    const doc = await documentDans(tx, ctx, acces.docId)
    const mon = await accesDe(tx, ctx, acces.docId, qui.personId)
    gardeDe(peutPartagerDocument(documentPourDroits(doc, mon), dossierPourDroits(doc.folder), qui))
    await tx.documentsAccess.update({ where: { id: accesId }, data: { deletedAt: new Date(), updatedBy: ctx.userId, rev: { increment: 1 } } })
  })
}

// Lectures partagées avec lectures-serveur.ts : mêmes lignes, mêmes décisions, aucune écriture.
export { accesDe, documentDans, documentPourDroits, dossierPourDroits }
export type { Client }
