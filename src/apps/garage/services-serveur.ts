// Services serveur du Garage (tâche 4.1, brief §4). Même forme que Voiture : chaque fonction publique passe par
// accesGarage(niveau) ; les fonctions « …Dans(ctx, …) » font le travail sans garde (bus, scripts, gestionnaires).
// Écritures concurrentes : avecReprisePourConflit. Les événements sont émis après l'écriture, jamais dedans.

import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { type Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { chargeFiabiliteChangee, chargePieceZoneRouge } from "./charges"
import { ErreurGarage, refus } from "./erreurs"
import { MODE_USURE_DEFAUT, TYPES_DEFAUT } from "./types-defaut"
import {
  dureesEffectives,
  etatPiece,
  etatPneus,
  fiabiliteChangee,
  franchitZoneRouge,
  indiceFiabilite,
  SEUILS_DEFAUT,
  seuilsValides,
  type ModeUsure,
  type OrganeIndice,
} from "./regles"

export { ErreurGarage }

// --- Accès ----------------------------------------------------------------------------------

export async function accesGarage(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("garage", requis)
  const ctx = { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } }
  return { ctx, niveau }
}

type Tx = Parameters<Parameters<typeof executerPourTeam>[2]>[0]

// --- Charges d'entrée -----------------------------------------------------------------------

const MODES = ["km", "epreuves", "les_deux"] as const
const QUALITES = ["origine", "renforcee", "competition"] as const
const STATUTS_PIECE_MANUELS = ["en_stock", "en_revision", "usee", "cassee", "vendue"] as const
const MOTIFS = ["usure", "casse", "preventif", "revision"] as const

const texte = (max: number) => z.string().trim().max(max).nullable().optional()
const entier = (min: number) => z.number().int().min(min)

const schemaOrgane = z
  .object({
    componentTypeId: z.string().min(1),
    position: texte(60),
    modeUsure: z.enum(MODES),
    dureeVieReferenceKm: entier(1).nullable().optional(),
    dureeVieReferenceEpreuves: entier(1).nullable().optional(),
    seuilOrangePct: entier(0).max(100).optional(),
    seuilRougePct: entier(0).max(100).optional(),
  })
  .strict()

const schemaModificationOrgane = schemaOrgane.partial().strict()

const schemaPiece = z
  .object({
    componentTypeId: z.string().min(1),
    designation: z.string().trim().min(1, "La désignation est obligatoire.").max(200),
    marque: texte(120),
    reference: texte(120),
    numeroSerie: texte(120),
    qualite: z.enum(QUALITES).optional(),
    dureeVieKm: entier(1).nullable().optional(),
    dureeVieEpreuves: entier(1).nullable().optional(),
    acheteeLe: z.string().nullable().optional(),
    prixCents: entier(0).nullable().optional(),
    fournisseurContactId: z.string().min(1).nullable().optional(),
    emplacement: texte(120),
  })
  .strict()

const schemaModificationPiece = schemaPiece.omit({ componentTypeId: true }).partial().strict()

const schemaUsureManuelle = z
  .object({
    km: z.number().min(0).max(100000).default(0),
    epreuve: z.boolean().default(false),
    date: z.string().nullable().optional(),
  })
  .strict()

export type EntreeOrgane = z.input<typeof schemaOrgane>
export type EntreePiece = z.input<typeof schemaPiece>
export type EntreeUsureManuelle = z.input<typeof schemaUsureManuelle>

// --- Initialisation : types et organes par défaut --------------------------------------------

// Copie les types par défaut dans la team (une fois, à la première écriture), puis crée un organe par type pour le
// véhicule (une fois par véhicule). Une ligne supprimée n'est jamais recréée : les comptes incluent les lignes retirées.
// Course entre deux initialisations (correction E) : les insertions passent par skipDuplicates (ON CONFLICT DO NOTHING).
// L'autre écriture a déjà créé la ligne, la nôtre n'ajoute rien et la transaction n'échoue pas. Les index uniques
// (types : team + nom et team + clé ; organes : véhicule + type + position) portent la garantie.
export async function initialiserGarageDans(tx: Tx, ctx: ContexteTeam, vehicleId: string): Promise<void> {
  const typesExistants = await tx.garageComponentType.count({ where: { teamId: ctx.teamId } })
  if (typesExistants === 0) {
    await tx.garageComponentType.createMany({
      skipDuplicates: true,
      data: TYPES_DEFAUT.map((t) => ({
        id: newId(),
        teamId: ctx.teamId,
        cle: t.cle,
        nom: t.nom,
        icone: t.icone,
        critique: t.critique,
        ordre: t.ordre,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })),
    })
  }

  const organesExistants = await tx.garageVehicleComponent.count({ where: { teamId: ctx.teamId, vehicleId } })
  if (organesExistants > 0) return

  // Un organe par type par défaut (ceux qui ont une clé), dans l'ordre de la liste.
  const types = await tx.garageComponentType.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, cle: { not: null } },
    select: { id: true },
    orderBy: { ordre: "asc" },
  })

  await tx.garageVehicleComponent.createMany({
    skipDuplicates: true,
    data: types.map((t) => ({
      id: newId(),
      teamId: ctx.teamId,
      vehicleId,
      componentTypeId: t.id,
      modeUsure: MODE_USURE_DEFAUT,
      seuilOrangePct: SEUILS_DEFAUT.orange,
      seuilRougePct: SEUILS_DEFAUT.rouge,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })),
  })
}

// --- Lecture d'état (sert aux zones, à l'indice et aux événements) -----------------------------

export type EtatPieceVehicule = { etat: number | null; seuilRouge: number; vehicleComponentId: string }
export type EtatsVehicule = { pieces: Map<string, EtatPieceVehicule>; indice: number | null }

export async function etatsDuVehicule(tx: Tx, teamId: string, vehicleId: string): Promise<EtatsVehicule> {
  const organes = await tx.garageVehicleComponent.findMany({
    where: { teamId, vehicleId, deletedAt: null },
    include: {
      componentType: { select: { cle: true, critique: true } },
      mounts: { where: { deposeeLe: null, deletedAt: null }, include: { part: true }, take: 1 },
      tyreSets: { where: { deletedAt: null }, select: { usureEstimeePct: true } },
    },
  })

  const pieces = new Map<string, EtatPieceVehicule>()
  const organesIndice: OrganeIndice[] = []

  for (const organe of organes) {
    const critique = organe.componentType.critique
    if (organe.componentType.cle === "pneus") {
      // Organe Pneus (correction C) : l'état vient du train monté, sans entrer dans l'indice (non critique).
      const train = organe.tyreSets[0]
      const etat = etatPneus(Boolean(train), train?.usureEstimeePct ?? null)
      organesIndice.push({ id: organe.id, critique, pieceMontee: Boolean(train), etat })
      continue
    }

    const montage = organe.mounts[0]
    const piece = montage?.part
    let etat: number | null = null
    if (piece) {
      const durees = dureesEffectives(
        { km: piece.dureeVieKm, epreuves: piece.dureeVieEpreuves },
        { km: organe.dureeVieReferenceKm, epreuves: organe.dureeVieReferenceEpreuves },
      )
      etat = etatPiece(organe.modeUsure as ModeUsure, durees, {
        km: Number(piece.kmCumules),
        epreuves: piece.epreuvesCumulees,
      })
      pieces.set(piece.id, { etat, seuilRouge: organe.seuilRougePct, vehicleComponentId: organe.id })
    }
    organesIndice.push({ id: organe.id, critique, pieceMontee: Boolean(piece), etat })
  }

  return { pieces, indice: indiceFiabilite(organesIndice).indice }
}

// Émet les événements de changement, après l'écriture : une pièce qui franchit le seuil rouge, un indice qui change.
async function emettreChangements(ctx: ContexteTeam, vehicleId: string, avant: EtatsVehicule): Promise<void> {
  const apres = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => etatsDuVehicule(tx, ctx.teamId, vehicleId))

  for (const [partId, piece] of Array.from(apres.pieces)) {
    if (piece.etat === null) continue
    const etatAvant = avant.pieces.get(partId)?.etat ?? null
    if (franchitZoneRouge(etatAvant, piece.etat, piece.seuilRouge)) {
      await emettre(
        ctx,
        "garage.piece_zone_rouge",
        chargePieceZoneRouge.parse({ partId, vehicleComponentId: piece.vehicleComponentId, vehicleId, etat: piece.etat }),
      )
    }
  }

  if (fiabiliteChangee(avant.indice, apres.indice)) {
    await emettre(
      ctx,
      "garage.fiabilite_changee",
      chargeFiabiliteChangee.parse({
        vehicleId,
        avant: avant.indice === null ? null : Math.round(avant.indice),
        apres: apres.indice === null ? null : Math.round(apres.indice),
      }),
    )
  }
}

// Exécute une écriture, puis émet les changements d'état qu'elle a produits. L'état « avant » est lu juste avant
// l'écriture. Une écriture qui renvoie « faux » n'a rien ajouté (usure déjà comptée par une autre validation) : rien
// n'est émis, pour qu'une course ne double pas un événement.
async function ecrireEtEmettre(ctx: ContexteTeam, vehicleId: string, ecriture: (tx: Tx) => Promise<boolean | void>): Promise<void> {
  const avant = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => etatsDuVehicule(tx, ctx.teamId, vehicleId))
  const aEcrit = await avecReprisePourConflit(() => executerPourTeam(ctx.teamId, ctx.userId, ecriture))
  if (aEcrit === false) return
  await emettreChangements(ctx, vehicleId, avant)
}

// Violation d'unicité Prisma (P2002) : une autre écriture occupe déjà la place.
function estDoublon(erreur: unknown): boolean {
  return typeof erreur === "object" && erreur !== null && (erreur as { code?: unknown }).code === "P2002"
}

// Écriture d'un organe : une place déjà occupée (même type, même position, sur ce véhicule) est un refus.
async function ecrireOrgane(ctx: ContexteTeam, vehicleId: string, ecriture: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await ecrireEtEmettre(ctx, vehicleId, ecriture)
  } catch (erreur) {
    if (estDoublon(erreur)) refus("Un organe de ce type existe déjà à cette position sur ce véhicule. Indiquez une autre position.")
    throw erreur
  }
}

// --- Vérifications communes -----------------------------------------------------------------

async function vehiculeDans(tx: Tx, teamId: string, vehicleId: string): Promise<void> {
  const vehicule = await tx.coreVehicle.findFirst({ where: { id: vehicleId, teamId, deletedAt: null }, select: { id: true } })
  if (!vehicule) refus("Véhicule introuvable.")
}

async function organeDans(tx: Tx, teamId: string, id: string) {
  const organe = await tx.garageVehicleComponent.findFirst({
    where: { id, teamId, deletedAt: null },
    include: { componentType: { select: { id: true } } },
  })
  if (!organe) refus("Organe introuvable.")
  return organe
}

async function pieceDans(tx: Tx, teamId: string, id: string) {
  const piece = await tx.garagePart.findFirst({ where: { id, teamId, deletedAt: null } })
  if (!piece) refus("Pièce introuvable.")
  return piece
}

async function typeDansTeam(tx: Tx, teamId: string, componentTypeId: string): Promise<void> {
  const type = await tx.garageComponentType.findFirst({ where: { id: componentTypeId, teamId, deletedAt: null }, select: { id: true } })
  if (!type) refus("Ce type d'organe n'existe pas dans la team.")
}

function verifierSeuils(orange: number, rouge: number): void {
  if (!seuilsValides({ orange, rouge })) {
    refus("Les seuils doivent respecter : 0 ≤ rouge < orange ≤ 100.")
  }
}

// --- Organes --------------------------------------------------------------------------------

export async function ajouterOrgane(vehicleId: string, entree: EntreeOrgane): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return ajouterOrganeDans(ctx, vehicleId, entree)
}

export async function ajouterOrganeDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeOrgane): Promise<string> {
  const donnees = schemaOrgane.parse(entree)
  const orange = donnees.seuilOrangePct ?? SEUILS_DEFAUT.orange
  const rouge = donnees.seuilRougePct ?? SEUILS_DEFAUT.rouge
  verifierSeuils(orange, rouge)
  const id = newId()

  await ecrireOrgane(ctx, vehicleId, async (tx) => {
    await vehiculeDans(tx, ctx.teamId, vehicleId)
    await initialiserGarageDans(tx, ctx, vehicleId)
    await typeDansTeam(tx, ctx.teamId, donnees.componentTypeId)
    await tx.garageVehicleComponent.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId,
        componentTypeId: donnees.componentTypeId,
        position: donnees.position ?? null,
        modeUsure: donnees.modeUsure,
        dureeVieReferenceKm: donnees.dureeVieReferenceKm ?? null,
        dureeVieReferenceEpreuves: donnees.dureeVieReferenceEpreuves ?? null,
        seuilOrangePct: orange,
        seuilRougePct: rouge,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  })
  return id
}

export async function modifierOrgane(id: string, entree: Partial<EntreeOrgane>): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return modifierOrganeDans(ctx, id, entree)
}

export async function modifierOrganeDans(ctx: ContexteTeam, id: string, entree: Partial<EntreeOrgane>): Promise<void> {
  const donnees = schemaModificationOrgane.parse(entree)
  const vehicleId = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => (await organeDans(tx, ctx.teamId, id)).vehicleId)

  await ecrireOrgane(ctx, vehicleId, async (tx) => {
    const actuel = await organeDans(tx, ctx.teamId, id)
    const orange = donnees.seuilOrangePct ?? actuel.seuilOrangePct
    const rouge = donnees.seuilRougePct ?? actuel.seuilRougePct
    verifierSeuils(orange, rouge)
    await tx.garageVehicleComponent.updateMany({
      where: { id, teamId: ctx.teamId },
      data: {
        position: donnees.position === undefined ? undefined : donnees.position,
        modeUsure: donnees.modeUsure,
        dureeVieReferenceKm: donnees.dureeVieReferenceKm === undefined ? undefined : donnees.dureeVieReferenceKm,
        dureeVieReferenceEpreuves:
          donnees.dureeVieReferenceEpreuves === undefined ? undefined : donnees.dureeVieReferenceEpreuves,
        seuilOrangePct: orange,
        seuilRougePct: rouge,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
  })
}

export async function retirerOrgane(id: string): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return retirerOrganeDans(ctx, id)
}

// Retrait logique. Refusé s'il porte une pièce montée : retirer un organe ne doit pas laisser une pose sans organe.
// Aucun état ne change : un organe sans pièce n'entre pas dans les zones ni dans l'indice.
export async function retirerOrganeDans(ctx: ContexteTeam, id: string): Promise<void> {
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const actuel = await organeDans(tx, ctx.teamId, id)
      const monte = await tx.garagePartMount.count({
        where: { vehicleComponentId: actuel.id, deposeeLe: null, deletedAt: null },
      })
      if (monte > 0) refus("Cet organe porte une pièce : déposez-la avant de le retirer.")
      await tx.garageVehicleComponent.updateMany({
        where: { id, teamId: ctx.teamId },
        data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    }),
  )
}

// --- Pièces ---------------------------------------------------------------------------------

export async function creerPiece(vehicleId: string, entree: EntreePiece): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return creerPieceDans(ctx, vehicleId, entree)
}

// Une pièce entre en stock de la voiture : statut « en stock », km et épreuves à zéro.
export async function creerPieceDans(ctx: ContexteTeam, vehicleId: string, entree: EntreePiece): Promise<string> {
  const donnees = schemaPiece.parse(entree)
  const id = newId()
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await vehiculeDans(tx, ctx.teamId, vehicleId)
      await typeDansTeam(tx, ctx.teamId, donnees.componentTypeId)
      await tx.garagePart.create({
        data: {
          id,
          teamId: ctx.teamId,
          vehicleId,
          componentTypeId: donnees.componentTypeId,
          designation: donnees.designation,
          marque: donnees.marque ?? null,
          reference: donnees.reference ?? null,
          numeroSerie: donnees.numeroSerie ?? null,
          qualite: donnees.qualite ?? "origine",
          dureeVieKm: donnees.dureeVieKm ?? null,
          dureeVieEpreuves: donnees.dureeVieEpreuves ?? null,
          acheteeLe: donnees.acheteeLe ? new Date(donnees.acheteeLe) : null,
          prixCents: donnees.prixCents ?? null,
          fournisseurContactId: donnees.fournisseurContactId ?? null,
          emplacement: donnees.emplacement ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    }),
  )
  return id
}

// Modifie les champs descriptifs et les durées de vie. Le statut et les cumuls ne passent pas par ici.
export async function modifierPiece(id: string, entree: Partial<EntreePiece>): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return modifierPieceDans(ctx, id, entree)
}

export async function modifierPieceDans(ctx: ContexteTeam, id: string, entree: Partial<EntreePiece>): Promise<void> {
  const donnees = schemaModificationPiece.parse(entree)
  const piece = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => pieceDans(tx, ctx.teamId, id))
  const vehicleId = piece.vehicleId

  await ecrireEtEmettre(ctx, vehicleId, async (tx) => {
    await pieceDans(tx, ctx.teamId, id)
    await tx.garagePart.updateMany({
      where: { id, teamId: ctx.teamId },
      data: {
        designation: donnees.designation,
        marque: donnees.marque === undefined ? undefined : donnees.marque,
        reference: donnees.reference === undefined ? undefined : donnees.reference,
        numeroSerie: donnees.numeroSerie === undefined ? undefined : donnees.numeroSerie,
        qualite: donnees.qualite,
        dureeVieKm: donnees.dureeVieKm === undefined ? undefined : donnees.dureeVieKm,
        dureeVieEpreuves: donnees.dureeVieEpreuves === undefined ? undefined : donnees.dureeVieEpreuves,
        acheteeLe: donnees.acheteeLe === undefined ? undefined : donnees.acheteeLe ? new Date(donnees.acheteeLe) : null,
        prixCents: donnees.prixCents === undefined ? undefined : donnees.prixCents,
        fournisseurContactId: donnees.fournisseurContactId === undefined ? undefined : donnees.fournisseurContactId,
        emplacement: donnees.emplacement === undefined ? undefined : donnees.emplacement,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
  })
}

// Changement de statut à la main. « Montée » ne se pose pas ici : la pose passe par poserPiece.
export async function changerStatutPiece(id: string, statut: (typeof STATUTS_PIECE_MANUELS)[number]): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return changerStatutPieceDans(ctx, id, statut)
}

export async function changerStatutPieceDans(
  ctx: ContexteTeam,
  id: string,
  statut: (typeof STATUTS_PIECE_MANUELS)[number],
): Promise<void> {
  if (!STATUTS_PIECE_MANUELS.includes(statut)) refus("Ce statut ne se choisit pas à la main.")
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const piece = await pieceDans(tx, ctx.teamId, id)
      if (piece.statut === "montee") refus("Cette pièce est montée : déposez-la avant de changer son statut.")
      await tx.garagePart.updateMany({
        where: { id, teamId: ctx.teamId },
        data: { statut, rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    }),
  )
}

// --- Pose et dépose -----------------------------------------------------------------------

// Statut d'une pièce déposée, selon le motif : usée, cassée, de retour en stock, ou en révision.
const STATUT_APRES_DEPOSE: Record<(typeof MOTIFS)[number], "usee" | "cassee" | "en_stock" | "en_revision"> = {
  usure: "usee",
  casse: "cassee",
  preventif: "en_stock",
  revision: "en_revision",
}

export async function poserPiece(
  vehicleComponentId: string,
  partId: string,
  options: { motifDepose?: (typeof MOTIFS)[number] | null } = {},
): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return poserPieceDans(ctx, vehicleComponentId, partId, options)
}

export async function poserPieceDans(
  ctx: ContexteTeam,
  vehicleComponentId: string,
  partId: string,
  options: { motifDepose?: (typeof MOTIFS)[number] | null } = {},
): Promise<string> {
  const motif = options.motifDepose ?? null
  if (motif !== null && !MOTIFS.includes(motif)) refus("Motif de dépose inconnu.")
  const vehicleId = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => (await organeDans(tx, ctx.teamId, vehicleComponentId)).vehicleId)
  const id = newId()

  await ecrireEtEmettre(ctx, vehicleId, async (tx) => {
    const organe = await organeDans(tx, ctx.teamId, vehicleComponentId)
    const piece = await pieceDans(tx, ctx.teamId, partId)
    if (piece.vehicleId !== organe.vehicleId) refus("Cette pièce est sur une autre voiture.")
    if (piece.componentTypeId !== organe.componentTypeId) refus("Cette pièce ne va pas sur ce type d'organe.")
    if (piece.statut === "montee") refus("Cette pièce est déjà montée : déposez-la d'abord.")

    const enPlace = await tx.garagePartMount.findFirst({
      where: { vehicleComponentId, deposeeLe: null, deletedAt: null },
      select: { id: true, partId: true },
    })
    if (enPlace) {
      if (!motif) refus("Un autre pièce est en place : indiquez le motif de sa dépose.")
      await deposerDans(tx, ctx, enPlace.id, motif)
    }

    await tx.garagePartMount.create({
      data: {
        id,
        teamId: ctx.teamId,
        partId,
        vehicleComponentId,
        poseLe: new Date(),
        kmPose: piece.kmCumules,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await tx.garagePart.updateMany({
      where: { id: partId, teamId: ctx.teamId },
      data: { statut: "montee", rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
  return id
}

async function deposerDans(tx: Tx, ctx: ContexteTeam, mountId: string, motif: (typeof MOTIFS)[number]): Promise<void> {
  const pose = await tx.garagePartMount.findFirst({
    where: { id: mountId, teamId: ctx.teamId, deletedAt: null },
    select: { id: true, partId: true, deposeeLe: true },
  })
  if (!pose || pose.deposeeLe !== null) refus("Cette pose n'est plus active.")
  await tx.garagePartMount.updateMany({
    where: { id: mountId, teamId: ctx.teamId },
    data: { deposeeLe: new Date(), motifDepose: motif, rev: { increment: 1 }, updatedBy: ctx.userId },
  })
  await tx.garagePart.updateMany({
    where: { id: pose.partId, teamId: ctx.teamId },
    data: { statut: STATUT_APRES_DEPOSE[motif], rev: { increment: 1 }, updatedBy: ctx.userId },
  })
}

export async function deposerPiece(mountId: string, motif: (typeof MOTIFS)[number]): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return deposerPieceDans(ctx, mountId, motif)
}

export async function deposerPieceDans(ctx: ContexteTeam, mountId: string, motif: (typeof MOTIFS)[number]): Promise<void> {
  if (!MOTIFS.includes(motif)) refus("Motif de dépose inconnu.")
  const vehicleId = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const pose = await tx.garagePartMount.findFirst({
      where: { id: mountId, teamId: ctx.teamId, deletedAt: null },
      include: { vehicleComponent: { select: { vehicleId: true } } },
    })
    if (!pose) refus("Cette pose est introuvable.")
    return pose.vehicleComponent.vehicleId
  })

  await ecrireEtEmettre(ctx, vehicleId, async (tx) => {
    await deposerDans(tx, ctx, mountId, motif)
  })
}

// --- Usure ------------------------------------------------------------------------------------

// Cibles d'usure d'un véhicule : les pièces montées et les trains de pneus montés sur l'organe Pneus.
async function ciblesUsure(tx: Tx, teamId: string, vehicleId: string) {
  const montees = await tx.garagePartMount.findMany({
    where: { teamId, deposeeLe: null, deletedAt: null, vehicleComponent: { vehicleId } },
    select: { partId: true },
  })
  const trains = await tx.garageTyreSet.findMany({
    where: { teamId, vehicleId, vehicleComponentId: { not: null }, deletedAt: null },
    select: { id: true },
  })
  return { partIds: montees.map((m) => m.partId), tyreSetIds: trains.map((t) => t.id) }
}

// Ajoute une usure (km et/ou une épreuve) à chaque cible. Renvoie vrai si au moins une ligne a été écrite.
// Une validation de résultat ne compte qu'une fois : l'index unique (cible, engagement, source) refuse la seconde ligne.
// skipDuplicates (ON CONFLICT DO NOTHING) remplace le P2002 : un doublon donne count 0, « déjà compté », et les cumuls
// de cette cible ne bougent pas. Une cible pas encore comptée l'est, même si une autre l'était déjà. Deux traitements
// simultanés sur le même engagement donnent une ligne par cible : le second attend le premier, puis n'ajoute rien.
export async function appliquerUsureDans(
  tx: Tx,
  ctx: ContexteTeam,
  cibles: { partIds: string[]; tyreSetIds: string[] },
  usure: { km: number; epreuve: boolean; date: Date; source: "resultat_saison" | "saisie_manuelle"; eventId: string | null; entryId: string | null },
): Promise<boolean> {
  const epreuves = usure.epreuve ? 1 : 0
  const ligne = {
    teamId: ctx.teamId,
    eventId: usure.eventId,
    eventEntryId: usure.entryId,
    kmAjoutes: usure.km,
    epreuveComptee: usure.epreuve,
    date: usure.date,
    source: usure.source,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }
  let ecrit = false

  for (const partId of cibles.partIds) {
    const { count } = await tx.garageWearLog.createMany({ data: [{ ...ligne, id: newId(), partId }], skipDuplicates: true })
    if (count === 0) continue
    ecrit = true
    await tx.garagePart.updateMany({
      where: { id: partId, teamId: ctx.teamId },
      data: { kmCumules: { increment: usure.km }, epreuvesCumulees: { increment: epreuves }, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  }

  for (const tyreSetId of cibles.tyreSetIds) {
    const { count } = await tx.garageWearLog.createMany({ data: [{ ...ligne, id: newId(), tyreSetId }], skipDuplicates: true })
    if (count === 0) continue
    ecrit = true
    await tx.garageTyreSet.updateMany({
      where: { id: tyreSetId, teamId: ctx.teamId },
      data: { kmSpeciale: { increment: usure.km }, nombreEpreuves: { increment: epreuves }, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  }

  return ecrit
}

// Usure saisie à la main (roulage ou essai) sur les pièces montées du véhicule. Source « saisie manuelle », sans engagement.
export async function ajouterUsureManuelle(vehicleId: string, entree: EntreeUsureManuelle): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return ajouterUsureManuelleDans(ctx, vehicleId, entree)
}

export async function ajouterUsureManuelleDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeUsureManuelle): Promise<void> {
  const donnees = schemaUsureManuelle.parse(entree)
  if (donnees.km === 0 && !donnees.epreuve) refus("Indiquez des kilomètres, une épreuve, ou les deux.")
  const date = donnees.date ? new Date(donnees.date) : new Date()

  await ecrireEtEmettre(ctx, vehicleId, async (tx) => {
    await vehiculeDans(tx, ctx.teamId, vehicleId)
    const cibles = await ciblesUsure(tx, ctx.teamId, vehicleId)
    return appliquerUsureDans(tx, ctx, cibles, {
      km: donnees.km,
      epreuve: donnees.epreuve,
      date,
      source: "saisie_manuelle",
      eventId: null,
      entryId: null,
    })
  })
}

// Usure d'un résultat validé (gestionnaire de saison.resultat_valide). Km chronométrés lus chez Saison ; sans km,
// l'épreuve compte et les km valent 0, ce qui est écrit dans le journal d'usure.
export async function appliquerUsureResultatDans(
  ctx: ContexteTeam,
  entryId: string,
  eventId: string | null,
  kmChronometres: number,
): Promise<void> {
  const vehicleId = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const engagement = await tx.coreEventEntry.findFirst({ where: { id: entryId, teamId: ctx.teamId }, select: { vehicleId: true } })
    return engagement?.vehicleId ?? null
  })
  // Un engagement sans véhicule (ou sans voiture de Garage) n'a pas d'usure à porter.
  if (!vehicleId) return

  await ecrireEtEmettre(ctx, vehicleId, async (tx) => {
    const cibles = await ciblesUsure(tx, ctx.teamId, vehicleId)
    return appliquerUsureDans(tx, ctx, cibles, {
      km: kmChronometres,
      epreuve: true,
      date: new Date(),
      source: "resultat_saison",
      eventId,
      entryId,
    })
  })
}
