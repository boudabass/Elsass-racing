// Services serveur des fiches casse (tâche 4.4, brief §3). Même forme que pneus-serveur.ts : chaque fonction publique passe
// par accesGarage(niveau) ; les fonctions « …Dans(ctx, …) » font le travail sans garde. Le gestionnaire de l'abandon
// appelle ouvrirFicheAbandonDans directement : il contrôle déjà son accès par le contexte de l'événement.

import type { z } from "zod"

import { lireAbandonEngagement } from "@/apps/saison/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { newId } from "@/core/ids"
import { executerPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { montageALaDate, titreReparationCasse, typeCasseValide, type TypeCasse } from "./casses"
import { chargeAbandonDeclare } from "./charges"
import { refus } from "./erreurs"
import { accesGarage, creerReparationTx } from "./services-serveur"

const CAUSE_MAX = 300

// Date civile « AAAA-MM-JJ », valide au calendrier. Renvoie la date UTC de minuit, ou null.
function dateCivileValide(texte: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return null
  const date = new Date(`${texte}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== texte ? null : date
}

function causeValide(cause: string | null): string | null {
  const nettoyee = cause?.trim() || null
  if (nettoyee && nettoyee.length > CAUSE_MAX) refus(`La cause tient en ${CAUSE_MAX} caractères au plus.`)
  return nettoyee
}

// --- Ouverture par un abandon déclaré dans Saison : une fiche par engagement, à compléter (954 §5) -------------------------

export type AbandonDeclare = z.input<typeof chargeAbandonDeclare>

// La fiche reprend la cause et la spéciale de l'abandon ; le type reste vide (à compléter). Une seule fiche par engagement :
// l'index unique partiel et skipDuplicates font qu'un second traitement ne crée rien. Engagement introuvable : une ligne de
// journal, aucune fiche, pas d'erreur.
export async function ouvrirFicheAbandonDans(ctx: ContexteTeam, abandon: AbandonDeclare): Promise<void> {
  const analyse = chargeAbandonDeclare.safeParse(abandon)
  if (!analyse.success) return
  const engagement = await lireAbandonEngagement(ctx, analyse.data.entryId, analyse.data.stageAbandonId ?? null)
  if (!engagement) {
    console.warn(`garage : abandon de l'engagement ${analyse.data.entryId} sans engagement lisible, aucune fiche casse ouverte.`)
    return
  }
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.garageIncident.createMany({
        data: [
          {
            id: newId(),
            teamId: ctx.teamId,
            vehicleId: engagement.vehicleId,
            eventId: engagement.eventId,
            eventEntryId: analyse.data.entryId,
            date: engagement.dateDebut,
            specialeNom: engagement.specialeNom,
            stageId: analyse.data.stageAbandonId ?? null,
            type: null,
            cause: causeValide(analyse.data.causeAbandon ?? null),
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        ],
        skipDuplicates: true,
      }),
    ),
  )
}

// --- Création à la main (sortie de route sans abandon, casse en essai) : voiture et date obligatoires ----------------

export interface EntreeFicheManuelle {
  vehicleId: string
  date: string
  eventId: string | null
  cause: string | null
}

export async function creerFicheCasse(entree: EntreeFicheManuelle): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return creerFicheCasseDans(ctx, entree)
}

export async function creerFicheCasseDans(ctx: ContexteTeam, entree: EntreeFicheManuelle): Promise<string> {
  const date = dateCivileValide(entree.date)
  if (!date) refus("Indique la date de la casse.")
  const cause = causeValide(entree.cause)
  const id = newId()
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const voiture = await tx.coreVehicle.findFirst({ where: { id: entree.vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
      if (!voiture) refus("Cette voiture n'existe pas dans la team.")
      if (entree.eventId) {
        const epreuve = await tx.coreEvent.findFirst({ where: { id: entree.eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
        if (!epreuve) refus("Cette épreuve n'existe pas dans la team.")
      }
      await tx.garageIncident.create({
        data: {
          id,
          teamId: ctx.teamId,
          vehicleId: entree.vehicleId,
          eventId: entree.eventId,
          eventEntryId: null,
          date,
          specialeNom: null,
          stageId: null,
          type: null,
          cause,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    }),
  )
  return id
}

// --- Complétion : type, cause, organes touchés et pièces cassées (954 §3) --------------------------------------------------

export interface EntreeCompletionFiche {
  type: string
  cause: string | null
  organesIds: string[]
  piecesIds: string[]
}

export async function completerFicheCasse(id: string, entree: EntreeCompletionFiche): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return completerFicheCasseDans(ctx, id, entree)
}

// Remplace les organes et pièces de la fiche. Les liens retirés passent par la suppression logique ; un lien rétabli est
// réactivé (l'index unique par fiche et cible s'applique aussi aux lignes supprimées).
// Une pièce cassée doit avoir été montée sur un organe touché à la date de la casse. Le Garage ne change pas le statut de la
// pièce : c'est le remplacement ou la dépose qui le fait (954, principe du 21/10).
export async function completerFicheCasseDans(ctx: ContexteTeam, id: string, entree: EntreeCompletionFiche): Promise<void> {
  if (!typeCasseValide(entree.type)) refus("Choisis le type de casse.")
  const type: TypeCasse = entree.type
  const cause = causeValide(entree.cause)
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const fiche = await tx.garageIncident.findFirst({
        where: { id, teamId: ctx.teamId, deletedAt: null },
        select: { vehicleId: true, date: true },
      })
      if (!fiche) refus("Cette fiche casse n'existe pas dans la team.")

      const organes = Array.from(new Set(entree.organesIds))
      const organesDeLaVoiture = await tx.garageVehicleComponent.count({
        where: { id: { in: organes }, vehicleId: fiche.vehicleId, teamId: ctx.teamId, deletedAt: null },
      })
      if (organesDeLaVoiture !== organes.length) refus("Un organe touché n'appartient pas à cette voiture.")

      const pieces = Array.from(new Set(entree.piecesIds))
      if (pieces.length > 0) {
        const montages = await tx.garagePartMount.findMany({
          where: { partId: { in: pieces }, vehicleComponentId: { in: organes }, teamId: ctx.teamId, deletedAt: null },
          select: { partId: true, poseLe: true, deposeeLe: true },
        })
        const montees = new Set(montages.filter((montage) => montageALaDate(montage, fiche.date)).map((montage) => montage.partId))
        if (pieces.some((piece) => !montees.has(piece))) {
          refus("Une pièce cassée n'était pas montée sur ces organes à la date de la casse.")
        }
      }

      await tx.garageIncident.updateMany({
        where: { id, teamId: ctx.teamId, deletedAt: null },
        data: { type, cause, rev: { increment: 1 }, updatedBy: ctx.userId },
      })

      await tx.garageIncidentComponent.updateMany({
        where: { incidentId: id, teamId: ctx.teamId, deletedAt: null, vehicleComponentId: { notIn: organes } },
        data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
      })
      for (const vehicleComponentId of organes) {
        await tx.garageIncidentComponent.upsert({
          where: { incidentId_vehicleComponentId: { incidentId: id, vehicleComponentId } },
          create: { id: newId(), teamId: ctx.teamId, incidentId: id, vehicleComponentId, createdBy: ctx.userId, updatedBy: ctx.userId },
          update: { deletedAt: null, rev: { increment: 1 }, updatedBy: ctx.userId },
        })
      }

      await tx.garageIncidentPart.updateMany({
        where: { incidentId: id, teamId: ctx.teamId, deletedAt: null, partId: { notIn: pieces } },
        data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
      })
      for (const partId of pieces) {
        await tx.garageIncidentPart.upsert({
          where: { incidentId_partId: { incidentId: id, partId } },
          create: { id: newId(), teamId: ctx.teamId, incidentId: id, partId, createdBy: ctx.userId, updatedBy: ctx.userId },
          update: { deletedAt: null, rev: { increment: 1 }, updatedBy: ctx.userId },
        })
      }
    }),
  )
}

// --- Réparation liée (954 §3) : un ordre de réparation sur un organe touché, une seule par fiche ---------------------------

export async function ouvrirReparationCasse(incidentId: string, organeId: string): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return ouvrirReparationCasseDans(ctx, incidentId, organeId)
}

// L'ordre et le lien de la fiche s'écrivent dans la même transaction : pas d'ordre orphelin si le lien échoue.
export async function ouvrirReparationCasseDans(ctx: ContexteTeam, incidentId: string, organeId: string): Promise<string> {
  return executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const fiche = await tx.garageIncident.findFirst({
      where: { id: incidentId, teamId: ctx.teamId, deletedAt: null },
      select: { eventId: true, reparationWorkOrderId: true },
    })
    if (!fiche) refus("Cette fiche casse n'existe pas dans la team.")
    if (fiche.reparationWorkOrderId) refus("Cette fiche a déjà une réparation liée.")
    const touche = await tx.garageIncidentComponent.findFirst({
      where: { incidentId, vehicleComponentId: organeId, teamId: ctx.teamId, deletedAt: null },
      select: { id: true },
    })
    if (!touche) refus("Cet organe n'est pas touché par cette casse.")
    const epreuve = fiche.eventId ? await tx.coreEvent.findFirst({ where: { id: fiche.eventId, teamId: ctx.teamId }, select: { nom: true } }) : null
    const reparation = await creerReparationTx(tx, ctx, organeId, {
      titre: titreReparationCasse(epreuve?.nom ?? null),
      coutMainOeuvreCents: null,
      prestataireContactId: null,
    })
    const { count } = await tx.garageIncident.updateMany({
      where: { id: incidentId, teamId: ctx.teamId, deletedAt: null, reparationWorkOrderId: null },
      data: { reparationWorkOrderId: reparation, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    if (count === 0) refus("Cette fiche a déjà une réparation liée.")
    return reparation
  })
}
