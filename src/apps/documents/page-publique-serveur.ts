// Données de la page publique d'un lien de partage (tâche 5.4, brief §1). Serveur seulement, hors session. Tout passe par
// avecContextePublic : une seule team, sans utilisateur. Chaque lecture refait les contrôles du lien (révoqué, expiré,
// document archivé ou supprimé) sous le contexte de la team trouvée : défense en profondeur après le middleware.
//
// Ce que la page ne montre jamais : les autres documents, les versions précédentes, les notes, le dossier, l'auteur, et le
// journal. Seule la version courante est servie.
import "server-only"

import { createHash } from "node:crypto"

import { newId } from "@/core/ids"
import { avecContextePublic } from "@/lib/prisma"

import type { LienDocument } from "./lien-public"
import { LIBELLE_TYPE_DOCUMENT } from "./libelles"
import type { TypeDocument } from "./regles"
import { selIp } from "./sel-ip"

export interface PageDocumentPublique {
  equipe: string
  titre: string
  typeLibelle: string
  // Date de validité du document (jour civil), ou null.
  valableJusquAu: Date | null
  // Fin du lien : la mention « Lien valable jusqu'au … » de la page.
  lienValableJusquAu: Date
  fichier: { id: string; nom: string; mimeType: string; taille: number } | null
}

const maintenant = () => new Date()

// Le lien, le document et la version courante tiennent encore : c'est la même condition dans la page, la route et le journal.
async function lienValide(tx: Parameters<Parameters<typeof avecContextePublic>[1]>[0], lien: LienDocument, quand: Date) {
  return tx.documentsShare.findFirst({
    where: {
      id: lien.shareId,
      teamId: lien.teamId,
      deletedAt: null,
      revokedAt: null,
      expiresAt: { gt: quand },
      doc: { id: lien.docId, teamId: lien.teamId, deletedAt: null, status: "actif" },
    },
    select: { expiresAt: true, doc: { select: { title: true, docType: true, validUntil: true, currentVersionId: true } } },
  })
}

// Version courante du document et son fichier, si le document en a un.
async function fichierCourant(tx: Parameters<Parameters<typeof avecContextePublic>[1]>[0], versionId: string | null) {
  if (!versionId) return null
  const version = await tx.documentsVersion.findFirst({ where: { id: versionId, deletedAt: null }, select: { attachmentId: true } })
  if (!version) return null
  const rattachement = await tx.coreAttachment.findFirst({ where: { id: version.attachmentId, deletedAt: null }, select: { fileId: true } })
  if (!rattachement) return null
  return tx.coreFile.findFirst({
    where: { id: rattachement.fileId, deletedAt: null },
    select: { id: true, nom: true, mimeType: true, taille: true, storageKey: true },
  })
}

export async function lirePageDocument(lien: LienDocument): Promise<PageDocumentPublique | null> {
  const quand = maintenant()
  return avecContextePublic(lien.teamId, async (tx) => {
    const share = await lienValide(tx, lien, quand)
    if (!share) return null
    const team = await tx.coreTeam.findFirst({ where: { id: lien.teamId, deletedAt: null }, select: { nom: true } })
    if (!team) return null
    const fichier = await fichierCourant(tx, share.doc.currentVersionId)
    return {
      equipe: team.nom,
      titre: share.doc.title,
      typeLibelle: LIBELLE_TYPE_DOCUMENT[share.doc.docType as TypeDocument],
      valableJusquAu: share.doc.validUntil,
      lienValableJusquAu: share.expiresAt,
      fichier: fichier ? { id: fichier.id, nom: fichier.nom, mimeType: fichier.mimeType, taille: fichier.taille } : null,
    }
  })
}

// Une ouverture de la page : une ligne au journal et open_count, dans la même transaction. Refus (false) si le lien ne
// vaut plus au moment d'écrire, ou si le sel d'IP manque en production.
export async function enregistrerOuverture(lien: LienDocument, adresseIp: string, agent: string | null): Promise<boolean> {
  const sel = selIp()
  if (!sel) return false
  const quand = maintenant()
  const ipHash = createHash("sha256").update(`${sel}:${adresseIp}`).digest("hex")
  return avecContextePublic(lien.teamId, async (tx) => {
    const share = await lienValide(tx, lien, quand)
    if (!share) return false
    await tx.documentsShareLog.create({
      data: {
        id: newId(),
        teamId: lien.teamId,
        shareId: lien.shareId,
        openedAt: quand,
        ipHash,
        userAgent: agent ? agent.slice(0, 300) : null,
      },
    })
    await tx.documentsShare.update({
      where: { id: lien.shareId },
      data: { openCount: { increment: 1 }, lastOpenedAt: quand, rev: { increment: 1 } },
    })
    return true
  })
}

// Le fichier servi est toujours la version courante du document, jamais une version précédente ; le lien doit valoir encore.
export async function lireFichierCourantDuLien(lien: LienDocument) {
  const quand = maintenant()
  return avecContextePublic(lien.teamId, async (tx) => {
    const share = await lienValide(tx, lien, quand)
    if (!share) return null
    return fichierCourant(tx, share.doc.currentVersionId)
  })
}
