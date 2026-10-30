// Écran Partages et liste d'un document (tâche 5.4, brief §1). Lecture seule. Un lien n'est jamais relu ici : seuls le
// destinataire, les dates, le nombre d'ouvertures et l'état sortent. Liens actifs d'abord, puis expirés et révoqués.

import { prismaPourTeam } from "@/lib/prisma"

import { accesDocuments } from "./services-serveur"
import { etatLien, LIBELLE_ETAT_LIEN, peutRevoquerLien, type EtatLien } from "./regles"

export interface LignePartage {
  id: string
  documentId: string
  documentTitre: string
  destinataire: string
  finLe: Date
  creeLe: Date
  ouvertures: number
  derniereOuverture: Date | null
  etat: EtatLien
  libelleEtat: string
  // Vrai si la personne peut révoquer (auteur au niveau écriture, ou niveau gestion).
  peutRevoquer: boolean
}

export interface PartagesDonnees {
  actifs: LignePartage[]
  inactifs: LignePartage[]
}

// Les liens de partage ne sont jamais ouverts à l'assistance (957) : l'écran et la liste de la fiche se cachent pour elle.
export async function liensVisiblesPourMoi(): Promise<boolean> {
  const { ctx } = await accesDocuments("lecture")
  return ctx.membership.role !== "assistance"
}

export async function lirePartages(documentId?: string): Promise<PartagesDonnees> {
  const { ctx, niveau } = await accesDocuments("lecture")
  const maintenant = new Date()
  const liens = await prismaPourTeam(ctx.teamId, ctx.userId).documentsShare.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, ...(documentId ? { docId: documentId } : {}) },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      docId: true,
      recipientLabel: true,
      expiresAt: true,
      revokedAt: true,
      openCount: true,
      lastOpenedAt: true,
      createdAt: true,
      createdBy: true,
      doc: { select: { title: true, deletedAt: true, status: true } },
    },
  })
  const lignes = liens.map((lien): LignePartage => {
    const etat = etatLien(
      { expiresAt: lien.expiresAt, revokedAt: lien.revokedAt },
      lien.doc.deletedAt === null && lien.doc.status === "actif",
      maintenant,
    )
    const peutRevoquer = peutRevoquerLien(lien.createdBy, ctx.userId, niveau).permis
    return {
      id: lien.id,
      documentId: lien.docId,
      documentTitre: lien.doc.title,
      destinataire: lien.recipientLabel ?? "Destinataire non précisé",
      finLe: lien.expiresAt,
      creeLe: lien.createdAt,
      ouvertures: lien.openCount,
      derniereOuverture: lien.lastOpenedAt,
      etat,
      libelleEtat: LIBELLE_ETAT_LIEN[etat],
      peutRevoquer,
    }
  })
  return {
    actifs: lignes.filter((l) => l.etat === "actif" || l.etat === "indisponible"),
    inactifs: lignes.filter((l) => l.etat === "expire" || l.etat === "revoque"),
  }
}

// Contacts de la team, pour le destinataire facultatif d'un lien (ASA, préfecture, sponsor).
export async function lireContactsPartage(): Promise<Array<{ id: string; libelle: string }>> {
  const { ctx } = await accesDocuments("ecriture")
  const contacts = await prismaPourTeam(ctx.teamId, ctx.userId).coreContact.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    orderBy: [{ nom: "asc" }],
    select: { id: true, nom: true },
  })
  return contacts.map((c) => ({ id: c.id, libelle: c.nom }))
}

