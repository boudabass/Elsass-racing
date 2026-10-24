// Lectures du Garage (tâche 4.1, brief §6) : l'état complet d'un véhicule pour l'atelier, et l'historique d'une
// pièce. Lecture seule, sous accesGarage("lecture"). Les prix n'existent dans les objets renvoyés qu'à partir du
// niveau écriture : l'assistance (contribution) n'en reçoit aucun (point 1 du brief). Un test le vérifie.

import { CLE_GABARIT_GENERIQUE, gabarit, type ElementDessin } from "@/apps/voiture/gabarits"
import { silhouetteDuVehicule } from "@/apps/voiture/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import type { Prisma } from "@/generated/prisma/client"
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
import { accesGarage, SELECTION_SAISIE, versSaisies } from "./services-serveur"
import { pointPourEmplacement, type PointSilhouette } from "./positions"
import type { PieceStock } from "./mise-en-forme"
import { comparerOrdres, type PrioriteTravail, type StatutOrdre, type TypeOrdre } from "./travaux"
import { dateDeParis, type StatutCommande } from "./commandes"
import { type PieceAtelier, versPiece } from "./vues"
import { LIBELLES_STATUT_PNEUS, LIBELLES_TYPE_PNEUS, type StatutPneus, type TypePneus } from "./pneus"

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
  // Repère sur la vue de dessus, nez en haut (null sans position pour cet organe).
  pointDessus: PointSilhouette | null
}

// Vue de dessus de l'atelier : celle du gabarit de la voiture, ou le schéma générique sans gabarit (repères compris).
export type SchemaAtelier = {
  gabaritCle: string
  sansGabarit: boolean
  dessin: ElementDessin[]
}

export type VehiculeAtelier = {
  vehicleId: string
  schema: SchemaAtelier
  organes: OrganeAtelier[]
  indice: number | null
  // Organes critiques sans pièce montée : signalés à part, jamais comptés à 0.
  sansPiece: string[]
  // Organes critiques avec pièce montée, durée de vie à renseigner : hors de la moyenne, nommés à part.
  sansEtat: string[]
}

type Client = ReturnType<typeof prismaPourTeam>

// Sans gabarit, l'atelier montre le schéma générique vu de dessus : les repères gardent leur place.
function schemaGenerique(): SchemaAtelier {
  const dessin: ElementDessin[] = gabarit(CLE_GABARIT_GENERIQUE)?.vuesDessinees.find((v) => v.vue === "dessus")?.dessin ?? []
  return { gabaritCle: CLE_GABARIT_GENERIQUE, sansGabarit: true, dessin }
}

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
  const schema = silhouette
    ? { gabaritCle: silhouette.gabaritCle, sansGabarit: false, dessin: silhouette.dessus }
    : schemaGenerique()
  const organesIndice: OrganeIndice[] = []
  // Dernière saisie après réparation de chaque pièce montée (954 v1.3, §4) : elle part de l'état saisi, pas de 100 %.
  const piecesMontees = organes.flatMap((organe) => organe.mounts.map((montage) => montage.part.id))
  const saisies = versSaisies(
    piecesMontees.length === 0
      ? []
      : await client.garagePartEtat.findMany({ where: { teamId: ctx.teamId, partId: { in: piecesMontees }, deletedAt: null }, select: SELECTION_SAISIE }),
  )
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
        pointDessus: pointPourEmplacement(schema.gabaritCle, { cle: organe.componentType.cle, position: organe.position }),
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
    const saisie = piece ? (saisies.get(piece.id) ?? null) : null
    const etat = piece && durees && usure ? etatPiece(mode, durees, usure, saisie) : null
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
      kmRestants: piece && durees && usure ? kmRestantsAvantRouge(mode, durees, usure, organe.seuilRougePct, saisie) : null,
      piece:
        piece && montage
          ? { ...versPiece(piece, avecPrix), poseLe: montage.poseLe, kmPose: Number(montage.kmPose) }
          : null,
      trainMonte: null,
      rechanges,
      pointDessus: pointPourEmplacement(schema.gabaritCle, { cle: organe.componentType.cle, position: organe.position }),
    }
  })

  const indice = indiceFiabilite(organesIndice)
  return {
    vehicleId,
    schema,
    organes: lignes,
    indice: indice.indice,
    sansPiece: indice.sansPiece,
    sansEtat: indice.sansEtat,
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

// État saisi après une réparation : « Réparé le …, état saisi : X % » dans l'historique de l'organe.
export type ReparationOrgane = { id: string; saisiLe: Date; etatPct: number }

export type FicheOrgane = {
  organe: OrganeAtelier
  vehicleId: string
  vehiculeNomCourt: string
  // Poses et déposes de toutes les pièces passées sur cet organe, la plus récente d'abord.
  poses: PoseOrgane[]
  // États saisis après réparation, la plus récente d'abord.
  reparations: ReparationOrgane[]
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
  // États saisis après réparation des pièces de cet organe (954 v1.3, §3 : garage_part_etat), le plus récent d'abord.
  const saisies = pieces.length === 0
    ? []
    : await client.garagePartEtat.findMany({
        where: { teamId: ctx.teamId, deletedAt: null, partId: { in: pieces.map((p) => p.id) } },
        orderBy: { saisiLe: "desc" },
      })

  return {
    organe,
    vehicleId: ligne.vehicleId,
    vehiculeNomCourt: voiture?.nomCourt ?? "",
    reparations: saisies.map((s) => ({ id: s.id, saisiLe: s.saisiLe, etatPct: s.etatPct })),
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
  // Réparation d'un organe avec pièce montée : la clôture demande l'état de la pièce après réparation (954 v1.3, §4).
  etatRequis: boolean
  // Une pièce est montée sur l'organe de l'ordre (tout type) : la fin demande son motif et ce qu'elle devient.
  pieceEnPlace: boolean
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
  const pieceMontee = o.vehicleComponentId
    ? await client.garagePartMount.count({ where: { vehicleComponentId: o.vehicleComponentId, teamId: ctx.teamId, deposeeLe: null, deletedAt: null } })
    : 0

  return {
    ordre: versOrdreTravail(o, peutEcrire),
    vehicleId: o.vehicleId,
    vehicleComponentId: o.vehicleComponentId,
    aFaireAvantEventId: o.aFaireAvantEventId,
    dureeEstimeeMinutes: o.dureeEstimeeMinutes,
    personIds: o.persons.map((lien) => lien.personId),
    pieces: o.parts.map((lien) => ({ partId: lien.partId, designation: lien.part.designation })),
    etatRequis: o.type === "reparation" && pieceMontee > 0,
    pieceEnPlace: pieceMontee > 0,
    peutEcrire,
  }
}

// Choix de l'intervention rapide : organes de la voiture, et pièces du stock (au niveau écriture seulement, car une pièce
// demande ce niveau). Les pièces portent le nom de leur organe, pour les grouper dans le formulaire.
export async function lireChoixIntervention(vehicleId: string): Promise<{
  organes: Array<{ id: string; nom: string }>
  // Organes qui ont une pièce en place : une pose y demande la destination de l'ancienne pièce (954 v1.2, §2).
  organesOccupes: string[]
  pieces: Array<{ id: string; designation: string; organeNom: string }> | null
}> {
  const { ctx, niveau } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [organes, montees] = await Promise.all([
    client.garageVehicleComponent.findMany({
      where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
      select: { id: true, componentType: { select: { nom: true, ordre: true } } },
      orderBy: { componentType: { ordre: "asc" } },
    }),
    client.garagePartMount.findMany({
      where: { teamId: ctx.teamId, deposeeLe: null, deletedAt: null, vehicleComponent: { vehicleId } },
      select: { vehicleComponentId: true },
    }),
  ])
  const pieces = aAuMoins(niveau, "ecriture")
    ? await client.garagePart.findMany({
        where: { teamId: ctx.teamId, vehicleId, deletedAt: null, statut: { not: "montee" } },
        select: { id: true, designation: true, componentType: { select: { nom: true } } },
        orderBy: { designation: "asc" },
      })
    : null
  return {
    organes: organes.map((o) => ({ id: o.id, nom: o.componentType.nom })),
    organesOccupes: montees.map((m) => m.vehicleComponentId),
    pieces: pieces?.map((p) => ({ id: p.id, designation: p.designation, organeNom: p.componentType.nom })) ?? null,
  }
}

// --- Commandes (tâche 4.3, brief §5) --------------------------------------------------------
// Écriture seulement : l'assistance n'a pas de commande. Les dates sortent en « AAAA-MM-JJ » : la date de Paris pour les
// instants (commande, réception), la date civile pour la livraison prévue.

export type QualitePieceAtelier = "origine" | "renforcee" | "competition"

export type LigneCommandeAtelier = {
  id: string
  designation: string
  reference: string | null
  quantite: number
  prixUnitaireCents: number
  qualite: QualitePieceAtelier
  organeNom: string | null
}

export type CommandeAtelier = {
  id: string
  fournisseurNom: string
  commandeeLe: string
  livraisonPrevueLe: string | null
  statut: StatutCommande
  recueLe: string | null
  totalCents: number
  devise: string
  lignes: LigneCommandeAtelier[]
}

export async function lireCommandes(vehicleId: string): Promise<CommandeAtelier[] | null> {
  const { ctx } = await accesGarage("ecriture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const voiture = await client.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!voiture) return null
  const commandes = await client.garagePurchase.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    include: {
      supplier: { select: { nom: true } },
      lines: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { componentType: { select: { nom: true } } },
      },
    },
    orderBy: { commandeeLe: "desc" },
    take: 100,
  })
  return commandes.map((commande) => {
    const lignes = commande.lines.map((ligne) => ({
      id: ligne.id,
      designation: ligne.designation,
      reference: ligne.reference,
      quantite: ligne.quantite,
      prixUnitaireCents: ligne.prixUnitaireCents,
      qualite: ligne.qualite as QualitePieceAtelier,
      organeNom: ligne.componentType?.nom ?? null,
    }))
    return {
      id: commande.id,
      fournisseurNom: commande.supplier.nom,
      commandeeLe: dateDeParis(commande.commandeeLe),
      livraisonPrevueLe: commande.livraisonPrevueLe ? commande.livraisonPrevueLe.toISOString().slice(0, 10) : null,
      statut: commande.statut,
      recueLe: commande.recueLe ? dateDeParis(commande.recueLe) : null,
      totalCents: commande.lines.reduce((somme, ligne) => somme + ligne.quantite * ligne.prixUnitaireCents, 0),
      devise: commande.lines[0]?.devise ?? "EUR",
      lignes,
    }
  })
}

// Choix du formulaire de commande : fournisseurs de la team, types d'organe (la pièce d'une ligne porte son type).
export async function lireChoixCommande(): Promise<{ fournisseurs: Array<{ id: string; nom: string }>; types: Array<{ id: string; nom: string }> }> {
  const { ctx } = await accesGarage("ecriture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [fournisseurs, types] = await Promise.all([
    client.coreContact.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    client.garageComponentType.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, nom: true }, orderBy: { ordre: "asc" } }),
  ])
  return { fournisseurs, types }
}

// --- Trains de pneus (tâche 4.4, §2) ------------------------------------------------------------

export interface TrainAtelier {
  id: string
  marque: string
  modele: string | null
  gomme: string | null
  type: TypePneus
  typeLibelle: string
  dimensions: string | null
  acheteLe: string | null
  nombreEpreuves: number
  kmSpeciale: number
  usureEstimeePct: number | null
  statut: StatutPneus
  statutLibelle: string
  // Vrai si le train est monté sur l'organe Pneus de la voiture.
  monte: boolean
}

export interface UsureTrain {
  date: string
  kmAjoutes: number
  epreuveComptee: boolean
}

function versTrain(train: {
  id: string
  marque: string
  modele: string | null
  gomme: string | null
  type: string
  dimensions: string | null
  acheteLe: Date | null
  nombreEpreuves: number
  kmSpeciale: Prisma.Decimal
  usureEstimeePct: number | null
  statut: string
  vehicleComponentId: string | null
}, organePneusId: string | null): TrainAtelier {
  const type = train.type as TypePneus
  const statut = train.statut as StatutPneus
  return {
    id: train.id,
    marque: train.marque,
    modele: train.modele,
    gomme: train.gomme,
    type,
    typeLibelle: LIBELLES_TYPE_PNEUS[type],
    dimensions: train.dimensions,
    acheteLe: train.acheteLe ? train.acheteLe.toISOString().slice(0, 10) : null,
    nombreEpreuves: train.nombreEpreuves,
    kmSpeciale: Number(train.kmSpeciale),
    usureEstimeePct: train.usureEstimeePct,
    statut,
    statutLibelle: LIBELLES_STATUT_PNEUS[statut],
    monte: organePneusId !== null && train.vehicleComponentId === organePneusId,
  }
}

// Les trains de la voiture : le monté en tête, puis les autres (brief §2). Les usés sont filtrés par l'écran.
export async function lireTrains(vehicleId: string): Promise<{ trains: TrainAtelier[]; organePneusId: string | null } | null> {
  const { ctx } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const voiture = await client.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!voiture) return null
  const organePneus = await client.garageVehicleComponent.findFirst({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null, componentType: { cle: "pneus" } },
    select: { id: true },
  })
  const trains = await client.garageTyreSet.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  })
  const liste = trains.map((t) => versTrain(t, organePneus?.id ?? null))
  liste.sort((a, b) => Number(b.monte) - Number(a.monte))
  return { trains: liste, organePneusId: organePneus?.id ?? null }
}

// Une fiche de train : le train, son organe Pneus et ses lignes d'usure (épreuve ou roulage, km), les plus récentes d'abord.
export async function lireTrain(id: string): Promise<{ train: TrainAtelier; usures: UsureTrain[]; organePneusId: string | null } | null> {
  const { ctx } = await accesGarage("lecture")
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const train = await client.garageTyreSet.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!train) return null
  const organePneus = await client.garageVehicleComponent.findFirst({
    where: { teamId: ctx.teamId, vehicleId: train.vehicleId, deletedAt: null, componentType: { cle: "pneus" } },
    select: { id: true },
  })
  const usures = await client.garageWearLog.findMany({
    where: { teamId: ctx.teamId, tyreSetId: id, deletedAt: null },
    orderBy: { date: "desc" },
  })
  return {
    train: versTrain(train, organePneus?.id ?? null),
    usures: usures.map((u) => ({ date: u.date.toISOString().slice(0, 10), kmAjoutes: Number(u.kmAjoutes), epreuveComptee: u.epreuveComptee })),
    organePneusId: organePneus?.id ?? null,
  }
}
