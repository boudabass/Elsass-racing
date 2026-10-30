// Liens de partage externes d'un document propre (tâche 5.4, brief §1 « Liens de partage externes »). Le jeton est créé
// ici, montré une seule fois à l'appelant, et seule son empreinte SHA-256 part en base (documents_share.token_hash).
// Le jeton n'est jamais journalisé ni renvoyé ailleurs.
import { randomBytes } from "node:crypto"

import { refus } from "./erreurs"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import type { ContexteTeam } from "@/core/contexte"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { chargeLienPartageCree, chargeLienPartageRevoque } from "./charges"
import { empreinteJeton } from "./lien-public"
import { accesDe, accesDocuments, documentDans, documentPourDroits, dossierPourDroits, gardeDe, personneDuMembre } from "./services-serveur"
import { dureeAutorisee, finDuLien, peutCreerLien, peutRevoquerLien } from "./regles"

export interface LienCree {
  shareId: string
  // Le jeton en clair : montré une seule fois, à la création. Il n'est pas relu ensuite.
  jeton: string
  finLe: Date
}

// Crée un lien de partage pour un document propre actif que la personne voit. Niveau écriture et plus (l'assistance non).
export async function creerLienPartage(
  docId: string,
  entree: { destinataire: string; contactId?: string | null; jours: number },
): Promise<LienCree> {
  const { ctx, niveau } = await accesDocuments("ecriture")
  const personId = await personneDuMembre(ctx)
  const destinataire = entree.destinataire.trim()
  if (destinataire.length === 0) refus("Indique le destinataire du lien : « Préfecture », « ASA Alsace »…")
  if (destinataire.length > 120) refus("Le nom du destinataire tient en 120 caractères.")
  if (!dureeAutorisee(entree.jours)) refus("Durée non prévue : 1, 7 ou 30 jours.")

  const maintenant = new Date()
  const finLe = finDuLien(maintenant, entree.jours)
  const jeton = randomBytes(32).toString("base64url")
  const shareId = newId()

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const doc = await documentDans(tx, ctx, docId)
    const acces = await accesDe(tx, ctx, docId, personId)
    gardeDe(peutCreerLien(documentPourDroits(doc, acces), dossierPourDroits(doc.folder), { personId, niveau }, doc.status === "actif"))

    if (entree.contactId) {
      const contact = await tx.coreContact.findFirst({ where: { id: entree.contactId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
      if (!contact) refus("Ce contact ne figure pas dans la team.")
    }
    await tx.documentsShare.create({
      data: {
        id: shareId,
        teamId: ctx.teamId,
        docId,
        tokenHash: empreinteJeton(jeton),
        recipientLabel: destinataire,
        recipientContactId: entree.contactId ?? null,
        expiresAt: finLe,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  })

  await emettre(ctx, "documents.lien_partage_cree", chargeLienPartageCree.parse({ shareId, documentId: docId, finLe: finLe.toISOString().slice(0, 10) }))
  return { shareId, jeton, finLe }
}

// Révoque un lien : son auteur (au niveau écriture) ou un responsable. Un lien déjà révoqué ne change plus.
export async function revoquerLienPartage(shareId: string): Promise<void> {
  const { ctx, niveau } = await accesDocuments("ecriture")
  const lien = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const existant = await tx.documentsShare.findFirst({
      where: { id: shareId, teamId: ctx.teamId, deletedAt: null },
      select: { id: true, docId: true, createdBy: true, revokedAt: true },
    })
    if (!existant) refus("Lien introuvable.")
    gardeDe(peutRevoquerLien(existant.createdBy, ctx.userId, niveau))
    if (existant.revokedAt) return null
    await tx.documentsShare.update({
      where: { id: existant.id },
      data: { revokedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    return existant
  })
  if (lien) {
    await emettre(ctx, "documents.lien_partage_revoque", chargeLienPartageRevoque.parse({ shareId, documentId: lien.docId, motif: "revoque" }))
  }
}

// Constat d'expiration, au recalcul du QG : un lien expiré et non révoqué émet « revoque » avec le motif « expire », une
// seule fois par lien (dédoublonnage sur core_domain_event, comme les papiers de Voiture).
export async function constaterLiensExpiresDans(ctx: ContexteTeam, maintenant: Date): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const liens = await client.documentsShare.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, revokedAt: null, expiresAt: { lte: maintenant } },
    select: { id: true, docId: true },
  })
  for (const lien of liens) {
    const dejaEmis = await client.coreDomainEvent.findFirst({
      where: {
        teamId: ctx.teamId,
        nom: "documents.lien_partage_revoque",
        AND: [{ donnees: { path: ["shareId"], equals: lien.id } }, { donnees: { path: ["motif"], equals: "expire" } }],
      },
      select: { id: true },
    })
    if (dejaEmis) continue
    await emettre(ctx, "documents.lien_partage_revoque", chargeLienPartageRevoque.parse({ shareId: lien.id, documentId: lien.docId, motif: "expire" }))
  }
}
