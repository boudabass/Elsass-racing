// Lectures des fiches casse (tâche 4.4, brief §3). Lecture seule, sous accesGarage("lecture"). Une fiche n'expose que les
// organes et pièces de sa voiture : les pièces proposées sont celles montées à la date de la casse.

import { prismaPourTeam } from "@/lib/prisma"

import { ficheACompleter, montageALaDate, typeCasseValide, type TypeCasse } from "./casses"
import { nomAvecPosition } from "./emplacements"
import { lireVehiculeAtelier } from "./lectures-serveur"
import { accesGarage } from "./services-serveur"

export interface FicheCasseListe {
  id: string
  date: Date
  epreuveNom: string | null
  specialeNom: string | null
  type: TypeCasse | null
  organesTouches: number
  reparationLiee: boolean
  aCompleter: boolean
}

// Les fiches de la voiture, « à compléter » en tête, puis les plus récentes d'abord.
export async function lireFichesCasse(vehicleId: string): Promise<FicheCasseListe[] | null> {
  const { ctx } = await accesGarage("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const voiture = await client.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!voiture) return null
  const fiches = await client.garageIncident.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      specialeNom: true,
      type: true,
      reparationWorkOrderId: true,
      event: { select: { nom: true } },
      components: { where: { deletedAt: null }, select: { id: true } },
    },
  })
  const liste = fiches.map((fiche) => {
    const type = fiche.type && typeCasseValide(fiche.type) ? fiche.type : null
    const organesTouches = fiche.components.length
    return {
      id: fiche.id,
      date: fiche.date,
      epreuveNom: fiche.event?.nom ?? null,
      specialeNom: fiche.specialeNom,
      type,
      organesTouches,
      reparationLiee: fiche.reparationWorkOrderId !== null,
      aCompleter: ficheACompleter({ type, organesTouches }),
    }
  })
  return liste.sort((a, b) => Number(b.aCompleter) - Number(a.aCompleter))
}

export interface OrganeChoix {
  id: string
  nom: string
}

export interface PieceChoix {
  id: string
  designation: string
  organeId: string
  organeNom: string
}

export interface DetailFicheCasse {
  id: string
  vehicleId: string
  date: Date
  epreuveNom: string | null
  specialeNom: string | null
  type: TypeCasse | null
  cause: string | null
  reparationWorkOrderId: string | null
  aCompleter: boolean
  // Organes de la voiture (pour le choix des organes touchés) et pièces montées sur eux à la date de la casse.
  organes: OrganeChoix[]
  piecesDisponibles: PieceChoix[]
  organesTouches: string[]
  piecesCassees: string[]
}

export async function lireFicheCasse(id: string): Promise<DetailFicheCasse | null> {
  const { ctx } = await accesGarage("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const fiche = await client.garageIncident.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    select: {
      vehicleId: true,
      date: true,
      specialeNom: true,
      type: true,
      cause: true,
      reparationWorkOrderId: true,
      event: { select: { nom: true } },
      components: { where: { deletedAt: null }, select: { vehicleComponentId: true } },
      parts: { where: { deletedAt: null }, select: { partId: true } },
    },
  })
  if (!fiche) return null

  const vehicule = await lireVehiculeAtelier(fiche.vehicleId)
  const organes = vehicule?.organes ?? []
  const nomDesOrganes = new Map(organes.map((organe) => [organe.id, organe.nom]))
  const montages =
    organes.length === 0
      ? []
      : await client.garagePartMount.findMany({
          where: { teamId: ctx.teamId, deletedAt: null, vehicleComponentId: { in: organes.map((organe) => organe.id) } },
          select: { partId: true, vehicleComponentId: true, poseLe: true, deposeeLe: true, part: { select: { designation: true, deletedAt: true } } },
        })
  const piecesDisponibles: PieceChoix[] = montages
    .filter((montage) => montage.part.deletedAt === null && montageALaDate(montage, fiche.date))
    .map((montage) => ({
      id: montage.partId,
      designation: montage.part.designation,
      organeId: montage.vehicleComponentId,
      organeNom: nomDesOrganes.get(montage.vehicleComponentId) ?? "",
    }))

  const type = fiche.type && typeCasseValide(fiche.type) ? fiche.type : null
  const organesTouches = fiche.components.map((lien) => lien.vehicleComponentId)
  return {
    id,
    vehicleId: fiche.vehicleId,
    date: fiche.date,
    epreuveNom: fiche.event?.nom ?? null,
    specialeNom: fiche.specialeNom,
    type,
    cause: fiche.cause,
    reparationWorkOrderId: fiche.reparationWorkOrderId,
    aCompleter: ficheACompleter({ type, organesTouches: organesTouches.length }),
    organes: organes.map((organe) => ({ id: organe.id, nom: nomAvecPosition(organe.nom, organe.position) })),
    piecesDisponibles,
    organesTouches,
    piecesCassees: fiche.parts.map((lien) => lien.partId),
  }
}

// Épreuves où la voiture est engagée, pour rattacher une casse créée à la main. Facultatif côté écran : une casse peut être
// hors épreuve.
export async function listerEpreuvesDeLaVoiture(vehicleId: string): Promise<Array<{ id: string; nom: string }>> {
  const { ctx } = await accesGarage("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagements = await client.coreEventEntry.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    select: { event: { select: { id: true, nom: true, dateDebut: true } } },
    orderBy: { event: { dateDebut: "desc" } },
  })
  return engagements.map((engagement) => ({ id: engagement.event.id, nom: engagement.event.nom }))
}
