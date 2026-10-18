// Service commun des fichiers (brief 3.1, sections 1.2 et 1.3). Écriture sur disque et ligne core_file
// dans le contexte de la team (RLS), rattachement à une fiche, remplacement. Les apps l'appellent dans
// leurs services, au moment où elles enregistrent la fiche.

import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

import type { CoreAttachmentRole } from "@/generated/prisma/client"
import type { ContexteTeam } from "@/core/contexte"
import { type Niveau, niveauEffectif } from "@/core/droits/niveaux"
import { newId } from "@/core/ids"
import { ErreurMetier } from "@/core/sdk/actions-serveur"
import type { Tx } from "@/core/synchro/registre"
import { prismaPourTeam } from "@/lib/prisma"
import { dossierStockage } from "@/lib/stockage"

import { cleStockage, detecterType, MESSAGE_FORMATS, nomPropre, TAILLE_MAX, type TypeFichier } from "./regles"

// Client de team : celui d'une transaction (synchro) ou celui de prismaPourTeam (en ligne).
export type ClientFichier = Pick<Tx, "coreFile" | "coreAttachment">

export interface FichierEnregistre {
  id: string
  nom: string
  mimeType: TypeFichier
  taille: number
}

function refus(message: string): never {
  throw new ErreurMetier(message)
}

// Chemin physique d'une clé de stockage, sous le dossier de stockage.
export function cheminFichier(storageKey: string): string {
  return path.join(dossierStockage(), ...storageKey.split("/"))
}

// Écrit le fichier, puis la ligne core_file. Le type est détecté dans le contenu, jamais dans le nom.
export async function enregistrerFichier(
  ctx: ContexteTeam,
  { octets, nomOrigine }: { octets: Uint8Array; nomOrigine: string },
): Promise<FichierEnregistre> {
  if (octets.byteLength > TAILLE_MAX) refus("Fichier trop lourd : 10 Mo au plus.")
  const type = detecterType(octets)
  if (!type) refus(MESSAGE_FORMATS)

  const id = newId()
  const maintenant = new Date()
  const storageKey = cleStockage(ctx.teamId, id, maintenant)
  const destination = cheminFichier(storageKey)
  const dossier = path.dirname(destination)
  const temporaire = path.join(dossier, `.${id}.tmp`)

  // Fichier temporaire du même dossier puis renommage : une coupure ne laisse jamais un fichier à moitié écrit.
  await mkdir(dossier, { recursive: true })
  try {
    await writeFile(temporaire, octets)
    await rename(temporaire, destination)
  } catch (erreur) {
    await unlink(temporaire).catch(() => undefined)
    throw erreur
  }

  const empreinte = createHash("sha256").update(octets).digest("hex")
  try {
    await prismaPourTeam(ctx.teamId, ctx.userId).coreFile.create({
      data: {
        id,
        teamId: ctx.teamId,
        storageKey,
        nom: nomPropre(nomOrigine),
        mimeType: type,
        taille: octets.byteLength,
        empreinte,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  } catch (erreur) {
    // Pas de ligne en base : on retire le fichier pour ne pas laisser d'orphelin.
    await unlink(destination).catch(() => undefined)
    throw erreur
  }

  return { id, nom: nomPropre(nomOrigine), mimeType: type, taille: octets.byteLength }
}

export type RoleRattachement = CoreAttachmentRole

export interface Rattachement {
  fileId: string
  app: string
  ficheType: string
  ficheId: string
  role: RoleRattachement
}

// Rattache un fichier à une fiche. Seul l'envoyeur, ou une fiche déjà liée à ce fichier, peut le faire.
export async function rattacherFichier(client: ClientFichier, ctx: ContexteTeam, rattachement: Rattachement): Promise<void> {
  const { fileId, app, ficheType, ficheId, role } = rattachement
  const fichier = await client.coreFile.findFirst({ where: { id: fileId, teamId: ctx.teamId, deletedAt: null }, select: { createdBy: true } })
  if (!fichier) refus("Fichier introuvable dans cette team.")

  const surLaFiche = { teamId: ctx.teamId, fileId, app, ficheType, ficheId, deletedAt: null }
  const dejaLie = await client.coreAttachment.findFirst({ where: surLaFiche, select: { id: true } })
  if (fichier.createdBy !== ctx.userId && !dejaLie) refus("Ce fichier a été envoyé par quelqu'un d'autre : envoie le tien.")

  // Pas de doublon : même fichier, même fiche, même rôle.
  const memeRole = await client.coreAttachment.findFirst({ where: { ...surLaFiche, role }, select: { id: true } })
  if (memeRole) return

  await client.coreAttachment.create({
    data: { id: newId(), teamId: ctx.teamId, fileId, app, ficheType, ficheId, role, createdBy: ctx.userId, updatedBy: ctx.userId },
  })
}

// Un fichier en remplace un autre (logo, ticket) : l'ancien reçoit deletedAt. Le fichier physique reste
// sur le disque ; sa purge viendra plus tard.
export async function remplacerFichier(client: ClientFichier, ctx: ContexteTeam, { ancienId, nouveauId }: { ancienId: string | null; nouveauId: string | null }): Promise<void> {
  if (!ancienId || ancienId === nouveauId) return
  await client.coreFile.updateMany({
    where: { id: ancienId, teamId: ctx.teamId, deletedAt: null },
    data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
  })
}

// Niveau effectif de la personne sur chaque app demandée (même règle que la garde exigerAcces).
export async function niveauxDe(ctx: ContexteTeam, apps: string[]): Promise<Partial<Record<string, Niveau>>> {
  if (apps.length === 0) return {}
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [acces, defauts] = await Promise.all([
    client.coreAppAccess.findMany({ where: { membershipId: ctx.membership.id, appCle: { in: apps } }, select: { appCle: true, niveau: true } }),
    client.coreRoleDefault.findMany({ where: { role: ctx.membership.role, appCle: { in: apps } }, select: { role: true, appCle: true, niveau: true } }),
  ])
  return Object.fromEntries(apps.map((appCle) => [appCle, niveauEffectif({ role: ctx.membership.role, appCle, acces, defauts })]))
}

// Ouvre un fichier en flux, sans le charger en mémoire. Renvoie null si le fichier manque sur le disque.
export async function ouvrirFlux(storageKey: string, taille: number): Promise<ReadableStream<Uint8Array> | null> {
  const chemin = cheminFichier(storageKey)
  try {
    const { size } = await stat(chemin)
    if (size !== taille) return null
  } catch {
    return null
  }
  return Readable.toWeb(createReadStream(chemin)) as ReadableStream<Uint8Array>
}
