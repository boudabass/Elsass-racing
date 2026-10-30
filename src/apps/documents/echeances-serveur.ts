// Échéances des documents propres (tâche 5.4, brief §1 « Alertes »). Une ligne documents_deadline par document propre
// actif qui a une date de validité. Les échéances reçues (papiers, licences, homologations) ne sont pas copiées : elles se
// lisent par les lectures partagées de leur app.
//
// Quand synchroniser : après chaque écriture qui touche la date, le statut ou la version d'un document (la levée de
// l'action est donc immédiate, pas seulement au prochain QG), et à l'ouverture du QG pour tous les documents.
// Le recalcul n'écrit que les lignes et les événements, une seule fois par étape.

import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import type { ContexteTeam } from "@/core/contexte"
import { emettre } from "@/core/evenements/bus-serveur"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { newId } from "@/core/ids"
import { prismaPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { chargeDocumentExpire, chargeDocumentExpireBientot } from "./charges"
import {
  dateCourte,
  dateReport,
  etapeAEnvoyer,
  etapeAlerte,
  prioriteEtape,
  titreRenouvellement,
  zoneDocument,
  type EtapeAlerte,
} from "./regles"

const APP = "documents"
const TYPE_DOCUMENT = "documents_doc"

// Clé d'unicité de l'action « Renouveler » : une par document et par date de validité. L'étape suivante remplace l'action
// précédente (même clé), et la levée la retrouve par cette même clé.
const cleAction = (documentId: string, echeance: Date) => `documents:${documentId}:${echeance.toISOString().slice(0, 10)}`

// Destinataires de l'action : les responsables actifs, et le propriétaire du document s'il a un compte actif avec la
// lecture sur Documents. La visibilité du document reste contrôlée à l'écran (peutVoirDocument).
async function destinatairesDuDocument(ctx: ContexteTeam, ownerPersonId: string | null): Promise<string[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const responsables = await client.coreMembership.findMany({
    where: { teamId: ctx.teamId, statut: "actif", deletedAt: null, role: "responsable" },
    select: { id: true },
  })
  const ids = new Set(responsables.map((membre) => membre.id))
  if (ownerPersonId) {
    const proprietaire = await client.coreMembership.findFirst({
      where: { teamId: ctx.teamId, personId: ownerPersonId, statut: "actif", deletedAt: null },
      select: { id: true, userId: true, role: true },
    })
    if (proprietaire) {
      // Niveau effectif du propriétaire sur Documents, lu comme pour sa propre session.
      const ctxProprietaire = {
        teamId: ctx.teamId,
        userId: proprietaire.userId,
        membership: { id: proprietaire.id, role: proprietaire.role },
      } as ContexteTeam
      if (aAuMoins(await niveauDe(ctxProprietaire, APP), "lecture")) ids.add(proprietaire.id)
    }
  }
  return Array.from(ids)
}

// Synchronise la ligne d'échéance d'un document. Sans effet si le document n'existe pas dans la team.
export async function synchroniserEcheanceDans(ctx: ContexteTeam, documentId: string, maintenant: Date = new Date()): Promise<void> {
  await avecReprisePourConflit(async () => {
    const client = prismaPourTeam(ctx.teamId, ctx.userId)
    const doc = await client.documentsDoc.findFirst({
      where: { id: documentId, teamId: ctx.teamId, deletedAt: null },
      select: { id: true, title: true, status: true, validUntil: true, ownerPersonId: true },
    })
    if (!doc) return

    const ligne = await client.documentsDeadline.findFirst({
      where: { teamId: ctx.teamId, sourceApp: APP, sourceTable: TYPE_DOCUMENT, sourceId: doc.id, deletedAt: null, resolvedAt: null },
    })
    const etape = doc.status === "actif" ? etapeAlerte(doc.validUntil, maintenant) : null

    // Plus d'étape (archivé, sans date, ou renouvelé au-delà de 60 jours) : la ligne est résolue et l'action levée.
    if (etape === null || doc.validUntil === null) {
      if (ligne) {
        await client.documentsDeadline.update({
          where: { id: ligne.id },
          data: { resolvedAt: maintenant, rev: { increment: 1 }, updatedBy: ctx.userId },
        })
        if (ligne.lastAlertStep !== null) await leverAction(ctx, doc.id, ligne.dueOn)
      }
      return
    }

    const zone = zoneDocument(doc.validUntil, maintenant)
    const dateChangee = ligne !== null && ligne.dueOn.getTime() !== doc.validUntil.getTime()

    // Date changée : l'action de l'ancienne date est levée, et l'étape repart de zéro pour la nouvelle date.
    if (ligne && dateChangee && ligne.lastAlertStep !== null) await leverAction(ctx, doc.id, ligne.dueOn)
    const derniereEnvoyee = dateChangee || ligne === null ? null : ligne.lastAlertStep

    const ligneCourante = ligne
      ? await client.documentsDeadline.update({
          where: { id: ligne.id },
          data: {
            label: doc.title,
            dueOn: doc.validUntil,
            zone: zone ?? "vert",
            ...(dateChangee ? { lastAlertStep: null, snoozedUntil: null } : {}),
            rev: { increment: 1 },
            updatedBy: ctx.userId,
          },
        })
      : await client.documentsDeadline.create({
          data: {
            id: newId(),
            teamId: ctx.teamId,
            sourceApp: APP,
            sourceTable: TYPE_DOCUMENT,
            sourceId: doc.id,
            label: doc.title,
            dueOn: doc.validUntil,
            zone: zone ?? "vert",
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        })

    const aEnvoyer = etapeAEnvoyer(etape, derniereEnvoyee)
    if (aEnvoyer === null) return
    await envoyerEtape(ctx, { id: doc.id, title: doc.title, validUntil: doc.validUntil, ownerPersonId: doc.ownerPersonId }, aEnvoyer, maintenant)
    await client.documentsDeadline.update({
      where: { id: ligneCourante.id },
      data: { lastAlertStep: aEnvoyer, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
}

// Levée de l'action d'une date de validité (renouvellement, archivage, ou changement de date).
async function leverAction(ctx: ContexteTeam, documentId: string, echeance: Date): Promise<void> {
  await emettre(ctx, "documents.action_levee", { cleUnicite: cleAction(documentId, echeance) })
}

// Événement et action pour une étape : « bientôt » ou « expiré », puis l'action pour les destinataires.
async function envoyerEtape(
  ctx: ContexteTeam,
  doc: { id: string; title: string; validUntil: Date; ownerPersonId: string | null },
  etape: EtapeAlerte,
  maintenant: Date,
): Promise<void> {
  const echeance = dateCourte(doc.validUntil).split("/").reverse().join("-")
  if (etape === "expire") {
    await emettre(ctx, "documents.document_expire", chargeDocumentExpire.parse({ documentId: doc.id, titre: doc.title, echeance }))
  } else {
    await emettre(
      ctx,
      "documents.document_expire_bientot",
      chargeDocumentExpireBientot.parse({ documentId: doc.id, titre: doc.title, echeance, etape }),
    )
  }
  const destinataires = await destinatairesDuDocument(ctx, doc.ownerPersonId)
  if (destinataires.length === 0) return
  await emettre(ctx, "documents.action_requise", {
    type: "renouveler_document",
    cleUnicite: cleAction(doc.id, doc.validUntil),
    titre: titreRenouvellement(doc.title, doc.validUntil, maintenant),
    contexte: doc.title,
    ficheType: TYPE_DOCUMENT,
    ficheId: doc.id,
    destinataires: { memberships: destinataires },
    boutons: [
      { cle: "reporter", libelle: "Reporter d'une semaine" },
      { cle: "ignorer", libelle: "Ignorer" },
    ],
    priorite: prioriteEtape(etape),
    niveauRequis: "contribution",
    cleRegroupement: "documents_a_renouveler",
  })
}

// Recalcul à l'ouverture du QG : tous les documents propres actifs. Sans effet si le membre n'a aucun niveau sur Documents.
export async function recalculerPourQg(ctx: ContexteTeam, niveau: Niveau): Promise<void> {
  if (niveau === "aucun") return
  const maintenant = new Date()
  const documents = await prismaPourTeam(ctx.teamId, ctx.userId).documentsDoc.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, status: "actif", validUntil: { not: null } },
    select: { id: true },
  })
  for (const document of documents) await synchroniserEcheanceDans(ctx, document.id, maintenant)
}

// Décisions de la boîte (core.action_decidee, action d'origine Documents). « Reporter » repousse la date de rappel de
// sept jours ; « Ignorer » ne fait rien jusqu'à la prochaine étape. « Ouvrir la fiche » est un lien, pas une décision.
export async function appliquerDecisionDocuments(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const donnees = evenement.donnees as { decision?: string; ficheId?: string }
  if (!donnees.ficheId || donnees.decision !== "reporter") return
  await prismaPourTeam(ctx.teamId, ctx.userId).documentsDeadline.updateMany({
    where: { teamId: ctx.teamId, sourceApp: APP, sourceTable: TYPE_DOCUMENT, sourceId: donnees.ficheId, deletedAt: null, resolvedAt: null },
    data: { snoozedUntil: dateReport(new Date()), rev: { increment: 1 }, updatedBy: ctx.userId },
  })
}

enregistrerGestionnaire(APP, "core.action_decidee", appliquerDecisionDocuments)
