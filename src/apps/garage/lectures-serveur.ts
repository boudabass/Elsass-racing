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
import type { PieceStock } from "./mise-en-forme"
import { comparerOrdres, type PrioriteTravail, type StatutOrdre, type TypeOrdre } from "./travaux"
import { type PieceAtelier, versPiece } from "./vues"

export type OrganeAtelier = {
  id: string
  // Type d'organe : c'est lui qu'une pièce de stock porte.
  componentTypeId: string
  nom: string
  icone: string
  position: string | null
  critique: boolean
  mode: ModeUsure
  etat: number | null
  zone: Zone
  seuilOrange: number
  seuilRouge: number
  // Durées de vie de référence de l'organe (le tiroir « Renseigner la durée de vie » les montre).
  dureeReferenceKm: number | null
  dureeReferenceEpreuves: number | null
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
        componentTypeId: organe.componentTypeId,
        nom: organe.componentType.nom,
        icone: organe.componentType.icone,
        position: organe.position,
        critique,
        mode,
        etat,
        zone: zoneDeEtat(etat, { orange: organe.seuilOrangePct, rouge: organe.seuilRougePct }),
        seuilOrange: organe.seuilOrangePct,
        seuilRouge: organe.seuilRougePct,
        dureeReferenceKm: organe.dureeVieReferenceKm,
        dureeReferenceEpreuves: organe.dureeVieReferenceEpreuves,
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
      componentTypeId: organe.componentTypeId,
      nom: organe.componentType.nom,
      icone: organe.componentType.icone,
      position: organe.position,
      critique,
      mode,
      etat,
      zone: zoneDeEtat(etat, { orange: organe.seuilOrangePct, rouge: organe.seuilRougePct }),
      seuilOrange: organe.seuilOrangePct,
      seuilRouge: organe.seuilRougePct,
      dureeReferenceKm: organe.dureeVieReferenceKm,
      dureeReferenceEpreuves: organe.dureeVieReferenceEpreuves,
      kmRestants: piece && durees && usure ?kmRestantsAvantRouge(mode, durees, usure, organe.seuilRougePct) : null,
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

// Véhicules de la team pour le choix de l'atelier (le nom court, comme dans le reste de la plateforme).
export type VehiculeChoisi = { id: string; nomCourt: string }

export async function listerVehiculesAtelier(): Promise<VehiculeChoisi[]> {
  const { ctx } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const vehicules = await client.coreVehicle.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { id: true, nomCourt: true },
    orderBy: { nomCourt: "asc" },
  })
  return vehicules.map((v) => ({ id: v.id, nomCourt: v.nomCourt }))
}

// --- Fiche organe (tâche 4.2, §2) -----------------------------------------------------------

export type PoseOrgane = {
  id: string
  designation: string
  marque: string | null
  poseLe: Date
  kmPose: number
  deposeeLe: Date | null
  motifDepose: string | null
}

export type UsureOrgane = {
  id: string
  date: Date
  kmAjoutes: number
  epreuveComptee: boolean
  source: string
  designation: string
}

export type FicheOrgane = {
  organe: OrganeAtelier
  vehicleId: string
  vehiculeNomCourt: string
  // Poses et déposes de toutes les pièces passées sur cet organe, la plus récente d'abord.
  poses: PoseOrgane[]
  // Usures ajoutées aux pièces de cet organe, la plus récente d'abord.
  usures: UsureOrgane[]
}

// Fiche d'un organe : l'état tel que l'atelier le calcule, puis l'historique. Null si l'organe n'existe pas dans la team.
export async function lireFicheOrgane(organeId: string): Promise<FicheOrgane | null> {
  const { ctx, niveau } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const ligne = await client.garageVehicleComponent.findFirst({
    where: { id: organeId, teamId: ctx.teamId, deletedAt: null },
    select: { vehicleId: true, componentTypeId: true },
  })
  if (!ligne) return null

  const vehicule = await lireVehiculeDans(ctx, ligne.vehicleId, aAuMoins(niveau, "ecriture"))
  const organe = vehicule?.organes.find((o) => o.id === organeId)
  if (!vehicule || !organe) return null
  const voiture = await client.coreVehicle.findFirst({ where: { id: ligne.vehicleId, teamId: ctx.teamId }, select: { nomCourt: true } })

  const montages = await client.garagePartMount.findMany({
    where: { vehicleComponentId: organeId, teamId: ctx.teamId, deletedAt: null },
    include: { part: { select: { designation: true, marque: true } } },
    orderBy: { poseLe: "desc" },
  })
  // Les pièces de ce type sur cette voiture : leur usure est celle de l'organe.
  const pieces = await client.garagePart.findMany({
    where: { teamId: ctx.teamId, vehicleId: ligne.vehicleId, componentTypeId: ligne.componentTypeId, deletedAt: null },
    select: { id: true, designation: true },
  })
  const usures = pieces.length === 0
    ? []
    : await client.garageWearLog.findMany({
        where: { teamId: ctx.teamId, deletedAt: null, partId: { in: pieces.map((p) => p.id) } },
        orderBy: { date: "desc" },
      })
  const designation = new Map(pieces.map((p) => [p.id, p.designation]))

  return {
    organe,
    vehicleId: ligne.vehicleId,
    vehiculeNomCourt: voiture?.nomCourt ?? "",
    poses: montages.map((m) => ({
      id: m.id,
      designation: m.part.designation,
      marque: m.part.marque,
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
      designation: designation.get(u.partId ?? "") ?? "",
    })),
  }
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

// --- Stock et fiche pièce (tâche 4.2, §3) ----------------------------------------------------

// Pièces de la voiture qui ne sont pas montées : le stock disponible, en révision, usé, cassé ou vendu. Null si la
// voiture n'existe pas dans la team.
export async function lireStock(vehicleId: string): Promise<PieceStock[] | null> {
  const { ctx } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const voiture = await client.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!voiture) return null
  const pieces = await client.garagePart.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null, statut: { not: "montee" } },
    include: { componentType: { select: { nom: true, ordre: true } } },
    orderBy: { designation: "asc" },
  })
  return pieces.map((p) => ({
    id: p.id,
    designation: p.designation,
    marque: p.marque,
    reference: p.reference,
    qualite: p.qualite,
    statut: p.statut,
    emplacement: p.emplacement,
    componentTypeId: p.componentTypeId,
    organeNom: p.componentType.nom,
    organeOrdre: p.componentType.ordre,
  }))
}

export type FichePiece = {
  historique: HistoriquePiece
  vehicleId: string
  vehiculeNomCourt: string
  organeId: string
  organeNom: string
  // Montée sur un organe : elle ne change pas de statut à la main.
  montee: boolean
  numeroSerie: string | null
  emplacement: string | null
  dureeVieKm: number | null
  dureeVieEpreuves: number | null
  acheteeLe: Date | null
  // Fournisseur et prix : seulement au niveau écriture (null sinon).
  fournisseurNom: string | null
}

// Fiche d'une pièce : son historique (lecture 4.1) et ses informations. Null si la pièce n'existe pas dans la team.
export async function lireFichePiece(partId: string): Promise<FichePiece | null> {
  const { ctx, niveau } = await accesGarage("lecture")
  const historique = await lireHistoriquePiece(partId)
  if (!historique) return null
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const piece = await client.garagePart.findFirst({
    where: { id: partId, teamId: ctx.teamId, deletedAt: null },
    select: {
      vehicleId: true,
      componentTypeId: true,
      numeroSerie: true,
      emplacement: true,
      dureeVieKm: true,
      dureeVieEpreuves: true,
      acheteeLe: true,
      componentType: { select: { nom: true } },
      fournisseur: { select: { nom: true } },
    },
  })
  if (!piece) return null
  const voiture = await client.coreVehicle.findFirst({ where: { id: piece.vehicleId, teamId: ctx.teamId }, select: { nomCourt: true } })
  const organe = await client.garageVehicleComponent.findFirst({
    where: { teamId: ctx.teamId, vehicleId: piece.vehicleId, componentTypeId: piece.componentTypeId, deletedAt: null },
    select: { id: true },
  })
  const montee = historique.piece.statut === "montee"
  return {
    historique,
    vehicleId: piece.vehicleId,
    vehiculeNomCourt: voiture?.nomCourt ?? "",
    organeId: organe?.id ?? "",
    organeNom: piece.componentType.nom,
    montee,
    numeroSerie: piece.numeroSerie,
    emplacement: piece.emplacement,
    dureeVieKm: piece.dureeVieKm,
    dureeVieEpreuves: piece.dureeVieEpreuves,
    acheteeLe: piece.acheteeLe,
    fournisseurNom: aAuMoins(niveau, "ecriture") ? piece.fournisseur?.nom ?? null : null,
  }
}

// Fournisseurs possibles d'une pièce : les contacts de la team. Réservé au niveau écriture (le choix ne sert qu'à lui).
export async function listerFournisseurs(): Promise<Array<{ id: string; nom: string }>> {
  const { ctx } = await accesGarage("ecriture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const contacts = await client.coreContact.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  })
  return contacts
}

// --- Travaux (tâche 4.3, §3) ----------------------------------------------------------------

export type OrdreTravail = {
  id: string
  titre: string
  type: TypeOrdre
  organeNom: string | null
  priorite: PrioriteTravail
  aFaireAvant: { nom: string; date: string } | null
  personnes: string[]
  avancementPct: number
  statut: StatutOrdre
  pieces: string[]
  // Coût et prestataire : présents seulement au niveau écriture. Absents des objets de l'assistance.
  cout?: { cents: number | null; devise: string }
  prestataire?: string | null
}

export type TravauxVehicule = { colonnes: Record<StatutOrdre, OrdreTravail[]>; peutEcrire: boolean }

const colonnesVides = (): Record<StatutOrdre, OrdreTravail[]> => ({ en_cours: [], prevu: [], termine: [] })

// Forme commune d'un ordre lu avec ses liens (liste et fiche). Les champs sont ceux de l'include ci-dessous.
type OrdreAvecLiens = {
  id: string
  titre: string
  type: TypeOrdre
  priorite: PrioriteTravail
  avancementPct: number
  statut: StatutOrdre
  devise: string
  coutMainOeuvreCents: number | null
  vehicleComponent: { componentType: { nom: string } } | null
  aFaireAvantEvent: { nom: string; dateDebut: Date } | null
  persons: Array<{ person: { prenom: string; nom: string } }>
  parts: Array<{ partId: string; part: { designation: string } }>
  prestataire: { nom: string } | null
}

// Mise en forme d'un ordre. Le coût et le prestataire ne sortent que si peutEcrire.
function versOrdreTravail(o: OrdreAvecLiens, peutEcrire: boolean): OrdreTravail {
  const ordre: OrdreTravail = {
    id: o.id,
    titre: o.titre,
    type: o.type,
    organeNom: o.vehicleComponent?.componentType.nom ?? null,
    priorite: o.priorite,
    aFaireAvant: o.aFaireAvantEvent ? { nom: o.aFaireAvantEvent.nom, date: o.aFaireAvantEvent.dateDebut.toISOString().slice(0, 10) } : null,
    personnes: o.persons.map((lien) => `${lien.person.prenom} ${lien.person.nom}`),
    avancementPct: o.avancementPct,
    statut: o.statut,
    pieces: o.parts.map((lien) => lien.part.designation),
  }
  if (peutEcrire) {
    ordre.cout = { cents: o.coutMainOeuvreCents, devise: o.devise }
    ordre.prestataire = o.prestataire?.nom ?? null
  }
  return ordre
}

// Ordres d'une voiture, par colonne. L'assistance ne voit que les ordres où son compte est affecté. Null si la voiture
// n'existe pas dans la team.
export async function lireTravaux(vehicleId: string): Promise<TravauxVehicule | null> {
  const { ctx, niveau } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const voiture = await client.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!voiture) return null

  const peutEcrire = aAuMoins(niveau, "ecriture")
  const moi = peutEcrire
    ? null
    : await client.corePerson.findFirst({ where: { teamId: ctx.teamId, userId: ctx.userId, deletedAt: null }, select: { id: true } })
  if (!peutEcrire && !moi) return { colonnes: colonnesVides(), peutEcrire }

  const ordres = await client.garageWorkOrder.findMany({
    where: {
      teamId: ctx.teamId,
      vehicleId,
      deletedAt: null,
      ...(peutEcrire ? {} : { persons: { some: { personId: moi?.id ?? "", deletedAt: null } } }),
    },
    include: {
      vehicleComponent: { select: { componentType: { select: { nom: true } } } },
      aFaireAvantEvent: { select: { nom: true, dateDebut: true } },
      persons: { where: { deletedAt: null }, select: { person: { select: { prenom: true, nom: true } } } },
      parts: { where: { deletedAt: null }, select: { partId: true, part: { select: { designation: true } } } },
      prestataire: { select: { nom: true } },
    },
  })

  const colonnes = colonnesVides()
  const lignes = ordres.map((o) => {
    const ordre = versOrdreTravail(o, peutEcrire)
    return { ordre, tri: { priorite: ordre.priorite, aFaireAvant: ordre.aFaireAvant?.date ?? null, titre: ordre.titre } }
  })

  for (const { ordre, tri } of lignes.sort((a, b) => comparerOrdres(a.tri, b.tri))) {
    colonnes[ordre.statut].push(ordre)
  }
  return { colonnes, peutEcrire }
}

// Choix des formulaires d'ordre : organes de la voiture, épreuves et personnes de la team. Niveau écriture seulement.
export async function lireChoixTravaux(vehicleId: string): Promise<{
  organes: Array<{ id: string; nom: string }>
  epreuves: Array<{ id: string; nom: string; date: string }>
  personnes: Array<{ id: string; nom: string }>
  prestataires: Array<{ id: string; nom: string }>
}> {
  const { ctx } = await accesGarage("ecriture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [organes, epreuves, personnes, prestataires] = await Promise.all([
    client.garageVehicleComponent.findMany({
      where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
      select: { id: true, componentType: { select: { nom: true, ordre: true } } },
      orderBy: { componentType: { ordre: "asc" } },
    }),
    client.coreEvent.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      select: { id: true, nom: true, dateDebut: true },
      orderBy: { dateDebut: "asc" },
      take: 100,
    }),
    client.corePerson.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      select: { id: true, prenom: true, nom: true },
      orderBy: [{ prenom: "asc" }, { nom: "asc" }],
    }),
    client.coreContact.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ])
  return {
    organes: organes.map((o) => ({ id: o.id, nom: o.componentType.nom })),
    epreuves: epreuves.map((e) => ({ id: e.id, nom: e.nom, date: e.dateDebut.toISOString().slice(0, 10) })),
    personnes: personnes.map((p) => ({ id: p.id, nom: `${p.prenom} ${p.nom}` })),
    prestataires,
  }
}

// Fiche d'un ordre : l'ordre, ses réglages (pour les formulaires), ses personnes et ses pièces. Même garde que la liste :
// l'assistance ne lit que ses ordres affectés, sans prix. Null si l'ordre n'existe pas ou n'est pas accessible.
export type FicheOrdre = {
  ordre: OrdreTravail
  vehicleId: string
  vehicleComponentId: string | null
  aFaireAvantEventId: string | null
  dureeEstimeeMinutes: number | null
  personIds: string[]
  pieces: Array<{ partId: string; designation: string }>
  peutEcrire: boolean
}

export async function lireOrdre(id: string): Promise<FicheOrdre | null> {
  const { ctx, niveau } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const peutEcrire = aAuMoins(niveau, "ecriture")
  const moi = peutEcrire
    ? null
    : await client.corePerson.findFirst({ where: { teamId: ctx.teamId, userId: ctx.userId, deletedAt: null }, select: { id: true } })
  if (!peutEcrire && !moi) return null

  const o = await client.garageWorkOrder.findFirst({
    where: {
      id,
      teamId: ctx.teamId,
      deletedAt: null,
      ...(peutEcrire ? {} : { persons: { some: { personId: moi?.id ?? "", deletedAt: null } } }),
    },
    include: {
      vehicleComponent: { select: { componentType: { select: { nom: true } } } },
      aFaireAvantEvent: { select: { nom: true, dateDebut: true } },
      persons: { where: { deletedAt: null }, select: { personId: true, person: { select: { prenom: true, nom: true } } } },
      parts: { where: { deletedAt: null }, select: { partId: true, part: { select: { designation: true } } } },
      prestataire: { select: { nom: true } },
    },
  })
  if (!o) return null

  return {
    ordre: versOrdreTravail(o, peutEcrire),
    vehicleId: o.vehicleId,
    vehicleComponentId: o.vehicleComponentId,
    aFaireAvantEventId: o.aFaireAvantEventId,
    dureeEstimeeMinutes: o.dureeEstimeeMinutes,
    personIds: o.persons.map((lien) => lien.personId),
    pieces: o.parts.map((lien) => ({ partId: lien.partId, designation: lien.part.designation })),
    peutEcrire,
  }
}

// Choix de l'intervention rapide : organes de la voiture, et pièces du stock (au niveau écriture seulement, car une pièce
// demande ce niveau). Les pièces portent le nom de leur organe, pour les grouper dans le formulaire.
export async function lireChoixIntervention(vehicleId: string): Promise<{
  organes: Array<{ id: string; nom: string }>
  pieces: Array<{ id: string; designation: string; organeNom: string }> | null
}> {
  const { ctx, niveau } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const organes = await client.garageVehicleComponent.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    select: { id: true, componentType: { select: { nom: true, ordre: true } } },
    orderBy: { componentType: { ordre: "asc" } },
  })
  const pieces = aAuMoins(niveau, "ecriture")
    ? await client.garagePart.findMany({
        where: { teamId: ctx.teamId, vehicleId, deletedAt: null, statut: { not: "montee" } },
        select: { id: true, designation: true, componentType: { select: { nom: true } } },
        orderBy: { designation: "asc" },
      })
    : null
  return {
    organes: organes.map((o) => ({ id: o.id, nom: o.componentType.nom })),
    pieces: pieces?.map((p) => ({ id: p.id, designation: p.designation, organeNom: p.componentType.nom })) ?? null,
  }
}
