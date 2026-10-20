// Lectures du Garage (tâche 4.1, brief §6) : l'état complet d'un véhicule pour l'atelier, et l'historique d'une
// pièce. Lecture seule, sous accesGarage("lecture"). Les prix n'existent dans les objets renvoyés qu'à partir du
// niveau écriture : l'assistance (contribution) n'en reçoit aucun (point 1 du brief). Un test le vérifie.

import { silhouetteDuVehicule, type SilhouetteVehicule } from "@/apps/voiture/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import { prismaPourTeam } from "@/lib/prisma"

import {
  dureesEffectives,
  etatPiece,
  etatPneus,
  indiceFiabilite,
  kmRestantsAvantRouge,
  zoneDeEtat,
  type ModeUsure,
  type OrganeIndice,
  type Zone,
} from "./regles"
import { accesGarage } from "./services-serveur"
import { pointPourOrgane, type PointSilhouette } from "./positions"
import { type PieceAtelier, versPiece } from "./vues"

export type OrganeAtelier = {
  id: string
  nom: string
  icone: string
  position: string | null
  critique: boolean
  mode: ModeUsure
  etat: number | null
  zone: Zone
  seuilOrange: number
  seuilRouge: number
  kmRestants: number | null
  // Pièce montée (organes autres que Pneus).
  piece: (PieceAtelier & { poseLe: Date; kmPose: number }) | null
  // Train monté (organe Pneus).
  trainMonte: { id: string; marque: string; usureEstimeePct: number | null } | null
  // Pièces de rechange en stock sur ce véhicule, du même type.
  rechanges: PieceAtelier[]
  // Point sur la silhouette (null sans gabarit, ou sans position pour cet organe).
  pointSilhouette: PointSilhouette | null
}

export type VehiculeAtelier = {
  vehicleId: string
  silhouette: SilhouetteVehicule | null
  organes: OrganeAtelier[]
  indice: number | null
  // Organes critiques sans pièce montée : signalés à part, jamais comptés à 0.
  sansPiece: string[]
}

type Client = ReturnType<typeof prismaPourTeam>

async function lireVehiculeDans(ctx: ContexteTeam, vehicleId: string, avecPrix: boolean): Promise<VehiculeAtelier | null> {
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const vehicule = await client.coreVehicle.findFirst({
    where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null },
    select: { id: true },
  })
  if (!vehicule) return null

  const organes = await client.garageVehicleComponent.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    include: {
      componentType: true,
      mounts: { where: { deposeeLe: null, deletedAt: null }, include: { part: true }, take: 1 },
      tyreSets: { where: { deletedAt: null } },
    },
    orderBy: { componentType: { ordre: "asc" } },
  })

  const stock = await client.garagePart.findMany({
    where: { teamId: ctx.teamId, vehicleId, statut: "en_stock", deletedAt: null },
    orderBy: { designation: "asc" },
  })

  const silhouette = await silhouetteDuVehicule(ctx, vehicleId)
  const organesIndice: OrganeIndice[] = []
  const lignes: OrganeAtelier[] = organes.map((organe) => {
    const critique = organe.componentType.critique
    const mode = organe.modeUsure as ModeUsure
    const rechanges = stock
      .filter((p) => p.componentTypeId === organe.componentTypeId)
      .map((p) => versPiece(p, avecPrix))

    if (organe.componentType.cle === "pneus") {
      // Organe Pneus : l'état vient du train monté (correction C), sans entrer dans l'indice.
      const train = organe.tyreSets[0]
      const etat = etatPneus(Boolean(train), train?.usureEstimeePct ?? null)
      organesIndice.push({ id: organe.id, critique, pieceMontee: Boolean(train), etat })
      return {
        id: organe.id,
        nom: organe.componentType.nom,
        icone: organe.componentType.icone,
        position: organe.position,
        critique,
        mode,
        etat,
        zone: zoneDeEtat(etat, { orange: organe.seuilOrangePct, rouge: organe.seuilRougePct }),
        seuilOrange: organe.seuilOrangePct,
        seuilRouge: organe.seuilRougePct,
        kmRestants: null,
        piece: null,
        trainMonte: train ? { id: train.id, marque: train.marque, usureEstimeePct: train.usureEstimeePct } : null,
        rechanges,
        pointSilhouette: pointPourOrgane(silhouette?.gabaritCle ?? null, organe.componentType),
      }
    }

    const montage = organe.mounts[0]
    const piece = montage?.part
    const durees = piece
      ? dureesEffectives(
          { km: piece.dureeVieKm, epreuves: piece.dureeVieEpreuves },
          { km: organe.dureeVieReferenceKm, epreuves: organe.dureeVieReferenceEpreuves },
        )
      : null
    const usure = piece ? { km: Number(piece.kmCumules), epreuves: piece.epreuvesCumulees } : null
    const etat = piece && durees && usure ? etatPiece(mode, durees, usure) : null
    organesIndice.push({ id: organe.id, critique, pieceMontee: Boolean(piece), etat })

    return {
      id: organe.id,
      nom: organe.componentType.nom,
      icone: organe.componentType.icone,
      position: organe.position,
      critique,
      mode,
      etat,
      zone: zoneDeEtat(etat, { orange: organe.seuilOrangePct, rouge: organe.seuilRougePct }),
      seuilOrange: organe.seuilOrangePct,
      seuilRouge: organe.seuilRougePct,
      kmRestants: piece && durees && usure ? kmRestantsAvantRouge(mode, durees, usure, organe.seuilRougePct) : null,
      piece:
        piece && montage
          ? { ...versPiece(piece, avecPrix), poseLe: montage.poseLe, kmPose: Number(montage.kmPose) }
          : null,
      trainMonte: null,
      rechanges,
      pointSilhouette: pointPourOrgane(silhouette?.gabaritCle ?? null, organe.componentType),
    }
  })

  const indice = indiceFiabilite(organesIndice)
  return {
    vehicleId,
    silhouette,
    organes: lignes,
    indice: indice.indice,
    sansPiece: indice.sansPiece,
  }
}

// État complet d'un véhicule pour l'atelier. Null si le véhicule n'existe pas dans la team.
export async function lireVehiculeAtelier(vehicleId: string): Promise<VehiculeAtelier | null> {
  const { ctx, niveau } = await accesGarage("lecture")
  return lireVehiculeDans(ctx, vehicleId, aAuMoins(niveau, "ecriture"))
}

export type HistoriquePiece = {
  piece: PieceAtelier
  montages: Array<{ id: string; vehicleComponentId: string; poseLe: Date; kmPose: number; deposeeLe: Date | null; motifDepose: string | null }>
  usures: Array<{ id: string; date: Date; kmAjoutes: number; epreuveComptee: boolean; source: string }>
}

// Vie d'une pièce : ses poses et déposes, et l'usure ajoutée à chaque épreuve ou roulage. Null si la pièce n'existe pas.
export async function lireHistoriquePiece(partId: string): Promise<HistoriquePiece | null> {
  const { ctx, niveau } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const piece = await client.garagePart.findFirst({ where: { id: partId, teamId: ctx.teamId, deletedAt: null } })
  if (!piece) return null

  const montages = await client.garagePartMount.findMany({
    where: { partId, teamId: ctx.teamId, deletedAt: null },
    orderBy: { poseLe: "desc" },
  })
  const usures = await client.garageWearLog.findMany({
    where: { partId, teamId: ctx.teamId, deletedAt: null },
    orderBy: { date: "desc" },
  })

  return {
    piece: versPiece(piece, aAuMoins(niveau, "ecriture")),
    montages: montages.map((m) => ({
      id: m.id,
      vehicleComponentId: m.vehicleComponentId,
      poseLe: m.poseLe,
      kmPose: Number(m.kmPose),
      deposeeLe: m.deposeeLe,
      motifDepose: m.motifDepose,
    })),
    usures: usures.map((u) => ({
      id: u.id,
      date: u.date,
      kmAjoutes: Number(u.kmAjoutes),
      epreuveComptee: u.epreuveComptee,
      source: u.source,
    })),
  }
}
