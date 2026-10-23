// Services serveur du Garage (tâche 4.1, brief §4). Même forme que Voiture : chaque fonction publique passe par
// accesGarage(niveau) ; les fonctions « …Dans(ctx, …) » font le travail sans garde (bus, scripts, gestionnaires).
// Écritures concurrentes : avecReprisePourConflit. Les événements sont émis après l'écriture, jamais dedans.

import { z } from "zod"

import type { Prisma } from "@/generated/prisma/client"
import type { ContexteTeam } from "@/core/contexte"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { chargeFiabiliteChangee, chargeInterventionFacturee, chargePieceAchetee, chargePieceZoneRouge, chargeTravailTermine } from "./charges"
import { receptionPossible } from "./commandes"
import { ErreurGarage, refus } from "./erreurs"
import { emplacementsDuType } from "./emplacements"
import { MODE_USURE_DEFAUT, TYPES_DEFAUT } from "./types-defaut"
import {
  DESTINATIONS_ANCIENNE,
  dureesEffectives,
  etatPiece,
  etatPneus,
  etatSaisiValide,
  fiabiliteChangee,
  franchitZoneRouge,
  indiceFiabilite,
  prixImposeFournisseur,
  saisieParPiece,
  SEUILS_DEFAUT,
  seuilsValides,
  statutDeDestination,
  type DestinationAncienne,
  type ModeUsure,
  type OrganeIndice,
  type SaisieEtat,
} from "./regles"
import { avancementValide, coutValide, PRIORITES_TRAVAIL, statutModifiable, TYPES_ORDRE } from "./travaux"

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

// Copie les types par défaut dans la team (une fois, à la première écriture), puis crée un organe par emplacement pour le
// véhicule (une fois par véhicule, brief 4.3e et 954 §3 : position par organe). Une ligne supprimée n'est jamais recréée :
// les comptes incluent les lignes retirées. Course entre deux initialisations (correction E) : les insertions passent
// par skipDuplicates (ON CONFLICT DO NOTHING). Les index uniques (types : team + nom et team + clé ; organes : véhicule +
// type + position) portent la garantie.
// Quand la voiture reçoit son jeu d'organes, chaque emplacement reçoit aussi sa pièce d'origine montée, et l'organe pneus
// son train d'origine (954 v1.2, Décisions intégrées : « Voiture équipée dès le départ »).
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

  // Un organe par emplacement de chaque type par défaut (ceux qui ont une clé), dans l'ordre de la liste des types.
  const types = await tx.garageComponentType.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, cle: { not: null } },
    select: { id: true, cle: true },
    orderBy: { ordre: "asc" },
  })

  await tx.garageVehicleComponent.createMany({
    skipDuplicates: true,
    data: types.flatMap((t) =>
      emplacementsDuType(t.cle).map((emplacement) => ({
        id: newId(),
        teamId: ctx.teamId,
        vehicleId,
        componentTypeId: t.id,
        position: emplacement.position,
        modeUsure: MODE_USURE_DEFAUT,
        seuilOrangePct: SEUILS_DEFAUT.orange,
        seuilRougePct: SEUILS_DEFAUT.rouge,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })),
    ),
  })

  await poserPiecesOrigineDans(tx, ctx, vehicleId)
}

// Pièces d'origine (954 v1.2, Décisions intégrées : « Voiture équipée dès le départ », décision de John du 21/10) : chaque
// organe reçoit une pièce d'origine montée (usure 0, durée de vie à renseigner, aucune valeur pré-remplie) ; l'organe pneus
// reçoit un train d'origine monté (asphalte, neuf, usure estimée à renseigner). Idempotent : un organe qui a déjà une pose
// active ou un train monté n'en reçoit pas. Deux initialisations simultanées ne doublent donc rien : la seconde voit les
// poses de la première, validées avec ses organes.
async function poserPiecesOrigineDans(tx: Tx, ctx: ContexteTeam, vehicleId: string): Promise<void> {
  const organes = await tx.garageVehicleComponent.findMany({
    where: {
      teamId: ctx.teamId,
      vehicleId,
      deletedAt: null,
      mounts: { none: { deletedAt: null, deposeeLe: null } },
      tyreSets: { none: { deletedAt: null } },
    },
    select: { id: true, componentTypeId: true, componentType: { select: { cle: true } } },
  })
  const maintenant = new Date()
  for (const organe of organes) {
    if (organe.componentType.cle === "pneus") {
      await tx.garageTyreSet.create({
        data: {
          id: newId(),
          teamId: ctx.teamId,
          vehicleId,
          vehicleComponentId: organe.id,
          marque: "D'origine",
          type: "asphalte",
          statut: "neuf",
          usureEstimeePct: null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      continue
    }
    const pieceId = newId()
    await tx.garagePart.create({
      data: {
        id: pieceId,
        teamId: ctx.teamId,
        vehicleId,
        componentTypeId: organe.componentTypeId,
        designation: "D'origine",
        qualite: "origine",
        statut: "montee",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await tx.garagePartMount.create({
      data: {
        id: newId(),
        teamId: ctx.teamId,
        partId: pieceId,
        vehicleComponentId: organe.id,
        poseLe: maintenant,
        kmPose: 0,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  }
}

// --- Lecture d'état (sert aux zones, à l'indice et aux événements) -----------------------------

export type EtatPieceVehicule = { etat: number | null; seuilRouge: number; vehicleComponentId: string }
export type EtatsVehicule = { pieces: Map<string, EtatPieceVehicule>; indice: number | null }

// Colonnes lues sur garage_part_etat pour l'état d'une pièce. Les lectures et les services les lisent de la même façon.
export const SELECTION_SAISIE = { partId: true, etatPct: true, kmAuSaisie: true, epreuvesAuSaisie: true, saisiLe: true } as const

// Dernière saisie après réparation de chaque pièce, à partir des lignes lues avec SELECTION_SAISIE (954 v1.3, §4).
export function versSaisies(lignes: Array<{ partId: string; etatPct: number; kmAuSaisie: Prisma.Decimal; epreuvesAuSaisie: number; saisiLe: Date }>): Map<string, SaisieEtat> {
  return saisieParPiece(
    lignes.map((ligne) => ({
      partId: ligne.partId,
      etatPct: ligne.etatPct,
      kmAuSaisie: Number(ligne.kmAuSaisie),
      epreuvesAuSaisie: ligne.epreuvesAuSaisie,
      saisiLe: ligne.saisiLe,
    })),
  )
}

// Dernière saisie de chaque pièce. Une pièce sans saisie n'a pas d'entrée dans la carte.
export async function saisiesDesPieces(tx: Tx, teamId: string, partIds: string[]): Promise<Map<string, SaisieEtat>> {
  if (partIds.length === 0) return new Map()
  const lignes = await tx.garagePartEtat.findMany({ where: { teamId, partId: { in: partIds }, deletedAt: null }, select: SELECTION_SAISIE })
  return versSaisies(lignes)
}

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
  const saisies = await saisiesDesPieces(tx, teamId, organes.flatMap((organe) => organe.mounts.map((montage) => montage.part.id)))

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
      etat = etatPiece(
        organe.modeUsure as ModeUsure,
        durees,
        { km: Number(piece.kmCumules), epreuves: piece.epreuvesCumulees },
        saisies.get(piece.id) ?? null,
      )
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

// Préparer l'atelier : l'action explicite qui pose les organes par défaut d'un véhicule qui n'en a pas (brief 4.1). Une
// lecture n'écrit jamais : c'est le seul chemin, avec la première écriture d'organe. Idempotent : un véhicule déjà suivi
// n'est pas touché.
export async function preparerAtelier(vehicleId: string): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return preparerAtelierDans(ctx, vehicleId)
}

export async function preparerAtelierDans(ctx: ContexteTeam, vehicleId: string): Promise<void> {
  await ecrireOrgane(ctx, vehicleId, async (tx) => {
    await vehiculeDans(tx, ctx.teamId, vehicleId)
    await initialiserGarageDans(tx, ctx, vehicleId)
  })
}

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

// Options de la pose : le motif et la destination de l'ancienne pièce, si une pièce est en place. Les deux sont demandés
// par le tiroir Remplacer (954 v1.2, §2) ; la destination n'a pas de valeur par défaut.
export interface OptionsPose {
  motifDepose?: (typeof MOTIFS)[number] | null
  destinationAncienne?: DestinationAncienne | null
}

export async function poserPiece(vehicleComponentId: string, partId: string, options: OptionsPose = {}): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return poserPieceDans(ctx, vehicleComponentId, partId, options)
}

export async function poserPieceDans(ctx: ContexteTeam, vehicleComponentId: string, partId: string, options: OptionsPose = {}): Promise<string> {
  const motif = options.motifDepose ?? null
  const destination = options.destinationAncienne ?? null
  if (motif !== null && !MOTIFS.includes(motif)) refus("Motif de dépose inconnu.")
  if (destination !== null && !DESTINATIONS_ANCIENNE.includes(destination)) refus("Destination de l'ancienne pièce inconnue.")
  const vehicleId = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => (await organeDans(tx, ctx.teamId, vehicleComponentId)).vehicleId)
  const id = newId()

  await ecrireEtEmettre(ctx, vehicleId, async (tx) => {
    const enPlace = await tx.garagePartMount.findFirst({
      where: { vehicleComponentId, deposeeLe: null, deletedAt: null },
      select: { id: true },
    })
    if (enPlace && destination === null) refus("Indiquez ce que devient l'ancienne pièce : réserve, rebut ou vendue.")
    await poserPieceTx(tx, ctx, id, vehicleComponentId, partId, motif, destination)
  })
  return id
}

// Remplacer avec une nouvelle pièce (954, Remplacer, voie 2). Avec un prix, la pièce passe par une commande saisie,
// expédiée et reçue tout de suite : la réception crée la pièce en stock et émet garage.piece_achetee (Budget). Sans prix,
// elle entre en stock directement. Dans les deux cas elle est ensuite posée, et l'ancienne pièce part selon sa destination.
export interface EntreeNouvellePiece {
  designation: string
  marque?: string | null
  qualite?: EntreePiece["qualite"]
  dureeVieKm?: number | null
  dureeVieEpreuves?: number | null
  prixCents?: number | null
  fournisseurContactId?: string | null
}

// Date civile du jour à Paris, « AAAA-MM-JJ ».
const jourParis = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

export async function poserNouvellePiece(vehicleComponentId: string, entree: EntreeNouvellePiece, options: OptionsPose = {}): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return poserNouvellePieceDans(ctx, vehicleComponentId, entree, options)
}

export async function poserNouvellePieceDans(
  ctx: ContexteTeam,
  vehicleComponentId: string,
  entree: EntreeNouvellePiece,
  options: OptionsPose = {},
): Promise<string> {
  const prix = entree.prixCents ?? null
  const fournisseur = entree.fournisseurContactId ?? null
  const refusPrix = prixImposeFournisseur(prix, fournisseur)
  if (refusPrix) refus(refusPrix)

  // Tout ce qui peut refuser se vérifie avant la première écriture : une pièce achetée puis refusée à la pose laisserait
  // une commande reçue, et un second envoi en créerait une deuxième.
  const organe = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => organeDans(tx, ctx.teamId, vehicleComponentId))
  const enPlace = await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.garagePartMount.findFirst({ where: { vehicleComponentId, deposeeLe: null, deletedAt: null }, select: { id: true } }),
  )
  if (enPlace && (!options.motifDepose || !options.destinationAncienne)) {
    refus("Indiquez le motif de dépose et ce que devient l'ancienne pièce.")
  }

  let partId: string
  if (prix !== null && fournisseur !== null) {
    const commandeId = await creerCommandeDans(ctx, organe.vehicleId, {
      supplierContactId: fournisseur,
      commandeeLe: jourParis(),
      lignes: [
        {
          designation: entree.designation,
          componentTypeId: organe.componentTypeId,
          quantite: 1,
          prixUnitaireCents: prix,
          qualite: entree.qualite ?? "origine",
        },
      ],
    })
    await expedierCommandeDans(ctx, commandeId)
    const [pieceId] = await recevoirCommandeDans(ctx, commandeId)
    if (!pieceId) refus("La réception n'a créé aucune pièce.")
    partId = pieceId
    // La réception ne porte ni la marque ni les durées de vie : elles se complètent sur la pièce reçue.
    if (entree.marque || entree.dureeVieKm || entree.dureeVieEpreuves) {
      await modifierPieceDans(ctx, partId, {
        marque: entree.marque ?? null,
        dureeVieKm: entree.dureeVieKm ?? null,
        dureeVieEpreuves: entree.dureeVieEpreuves ?? null,
      })
    }
  } else {
    partId = await creerPieceDans(ctx, organe.vehicleId, {
      componentTypeId: organe.componentTypeId,
      designation: entree.designation,
      marque: entree.marque ?? null,
      qualite: entree.qualite ?? "origine",
      dureeVieKm: entree.dureeVieKm ?? null,
      dureeVieEpreuves: entree.dureeVieEpreuves ?? null,
    })
  }

  await poserPieceDans(ctx, vehicleComponentId, partId, options)
  return partId
}

// Pose dans une transaction déjà ouverte. Sert aussi à la fin d'un ordre de remplacement (Garage 4.3, D1 et D7) :
// la pose et la fin de l'ordre s'écrivent ensemble, ou pas du tout. Sans destination (fin d'ordre), le statut de la
// pièce déposée suit son motif.
export async function poserPieceTx(
  tx: Tx,
  ctx: ContexteTeam,
  id: string,
  vehicleComponentId: string,
  partId: string,
  motif: (typeof MOTIFS)[number] | null,
  destination: DestinationAncienne | null = null,
): Promise<void> {
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
    await deposerDans(tx, ctx, enPlace.id, motif, destination)
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
}

// Le motif reste la raison de la dépose. Le statut suit la destination si elle est donnée (Remplacer), sinon le motif.
async function deposerDans(
  tx: Tx,
  ctx: ContexteTeam,
  mountId: string,
  motif: (typeof MOTIFS)[number],
  destination: DestinationAncienne | null = null,
): Promise<void> {
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
    data: {
      statut: destination ? statutDeDestination(destination) : STATUT_APRES_DEPOSE[motif],
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
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

// --- Travaux (ordres de travail, tâche 4.3, brief §3) -----------------------------------------
// Création, réglages, affectations, coût et pièces : écriture. Avancement et statut en cours : contribution, sur les
// ordres affectés seulement (la personne du compte, CorePerson.userId). Fin : contribution sans pièce, écriture avec
// pièce (D2). La fin est une transaction (D1, D3) ; ses événements partent après (D7).

const schemaOrdre = z
  .object({
    type: z.enum(TYPES_ORDRE),
    titre: z.string().trim().min(1, "Le titre est obligatoire.").max(200),
    vehicleComponentId: z.string().min(1).nullable().optional(),
    priorite: z.enum(PRIORITES_TRAVAIL).default("normale"),
    aFaireAvantEventId: z.string().min(1).nullable().optional(),
    dureeEstimeeMinutes: entier(1).nullable().optional(),
    personIds: z.array(z.string().min(1)).default([]),
  })
  .strict()

const schemaModificationOrdre = schemaOrdre.omit({ personIds: true }).partial().strict()

const schemaCout = z
  .object({
    coutMainOeuvreCents: entier(0).nullable(),
    prestataireContactId: z.string().min(1).nullable(),
  })
  .strict()

export type EntreeOrdre = z.input<typeof schemaOrdre>
export type EntreeModificationOrdre = z.input<typeof schemaModificationOrdre>
export type EntreeCout = z.input<typeof schemaCout>

// Personne du compte connecté dans la team (fiche personne liée au compte), ou null.
async function personneDuCompte(tx: Tx, ctx: ContexteTeam): Promise<string | null> {
  const personne = await tx.corePerson.findFirst({ where: { teamId: ctx.teamId, userId: ctx.userId, deletedAt: null }, select: { id: true } })
  return personne?.id ?? null
}

// Assistance : l'ordre doit être affecté à la personne du compte. Les autres niveaux n'ont pas ce contrôle.
async function verifierAffecte(tx: Tx, ctx: ContexteTeam, workOrderId: string): Promise<void> {
  const personneId = await personneDuCompte(tx, ctx)
  const lien = personneId
    ? await tx.garageWorkOrderPerson.findFirst({ where: { workOrderId, personId: personneId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    : null
  if (!lien) refus("Cet ordre ne vous est pas affecté.")
}

async function ordreDans(tx: Tx, teamId: string, id: string) {
  const ordre = await tx.garageWorkOrder.findFirst({ where: { id, teamId, deletedAt: null } })
  if (!ordre) refus("Ordre de travail introuvable.")
  return ordre
}

async function personnesDans(tx: Tx, teamId: string, ids: string[]): Promise<void> {
  const uniques = Array.from(new Set(ids))
  if (uniques.length === 0) return
  const trouvees = await tx.corePerson.count({ where: { id: { in: uniques }, teamId, deletedAt: null } })
  if (trouvees !== uniques.length) refus("Une personne choisie n'existe pas dans la team.")
}

async function liensDansOrdre(tx: Tx, ctx: ContexteTeam, vehicleId: string, donnees: { vehicleComponentId?: string | null; aFaireAvantEventId?: string | null }): Promise<void> {
  if (donnees.vehicleComponentId) {
    const organe = await organeDans(tx, ctx.teamId, donnees.vehicleComponentId)
    if (organe.vehicleId !== vehicleId) refus("Cet organe n'est pas sur ce véhicule.")
  }
  if (donnees.aFaireAvantEventId) {
    const epreuve = await tx.coreEvent.findFirst({ where: { id: donnees.aFaireAvantEventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!epreuve) refus("Cette épreuve n'existe pas dans la team.")
  }
}

// Affectations : une ligne par personne, jamais supprimée (deletedAt), ré-affectée en restaurant la ligne existante.
async function affecterDans(tx: Tx, ctx: ContexteTeam, workOrderId: string, personIds: string[]): Promise<void> {
  const voulues = new Set(personIds)
  const liens = await tx.garageWorkOrderPerson.findMany({ where: { workOrderId, teamId: ctx.teamId }, select: { id: true, personId: true, deletedAt: true } })
  for (const lien of liens) {
    const doit = voulues.has(lien.personId)
    if (doit && lien.deletedAt) {
      await tx.garageWorkOrderPerson.updateMany({ where: { id: lien.id, teamId: ctx.teamId }, data: { deletedAt: null, rev: { increment: 1 }, updatedBy: ctx.userId } })
    } else if (!doit && !lien.deletedAt) {
      await tx.garageWorkOrderPerson.updateMany({ where: { id: lien.id, teamId: ctx.teamId }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } })
    }
  }
  const dejaLa = new Set(liens.map((lien) => lien.personId))
  const nouvelles = Array.from(voulues).filter((personId) => !dejaLa.has(personId))
  if (nouvelles.length > 0) {
    await tx.garageWorkOrderPerson.createMany({
      data: nouvelles.map((personId) => ({ id: newId(), teamId: ctx.teamId, workOrderId, personId, createdBy: ctx.userId, updatedBy: ctx.userId })),
      skipDuplicates: true,
    })
  }
}

export async function creerOrdre(vehicleId: string, entree: EntreeOrdre): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return creerOrdreDans(ctx, vehicleId, entree)
}

export async function creerOrdreDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeOrdre): Promise<string> {
  const donnees = schemaOrdre.parse(entree)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await vehiculeDans(tx, ctx.teamId, vehicleId)
    await liensDansOrdre(tx, ctx, vehicleId, donnees)
    await personnesDans(tx, ctx.teamId, donnees.personIds)
    await tx.garageWorkOrder.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId,
        type: donnees.type,
        titre: donnees.titre,
        vehicleComponentId: donnees.vehicleComponentId ?? null,
        priorite: donnees.priorite,
        aFaireAvantEventId: donnees.aFaireAvantEventId ?? null,
        dureeEstimeeMinutes: donnees.dureeEstimeeMinutes ?? null,
        origine: "saisie",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await affecterDans(tx, ctx, id, donnees.personIds)
  })
  return id
}

// Réparer (954 v1.3, §2, Fiche organe) : un ordre de travail de type réparation sur l'organe, à faire. Sa clôture (Terminer)
// demande l'état de la pièce quand l'organe en a une (954 v1.3, §4). Coût et prestataire sont facultatifs et s'écrivent
// dans la même transaction que l'ordre. Écriture seulement.
const schemaReparation = z
  .object({
    titre: z.string().trim().min(1, "Dites ce qui est réparé.").max(200),
    coutMainOeuvreCents: entier(0).nullable().optional(),
    prestataireContactId: z.string().min(1).nullable().optional(),
  })
  .strict()

export type EntreeReparation = z.input<typeof schemaReparation>

export async function reparerOrgane(organeId: string, entree: EntreeReparation): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return reparerOrganeDans(ctx, organeId, entree)
}

export async function reparerOrganeDans(ctx: ContexteTeam, organeId: string, entree: EntreeReparation): Promise<string> {
  const donnees = schemaReparation.parse(entree)
  if (!coutValide(donnees.coutMainOeuvreCents ?? null)) refus("Le coût doit être un montant positif, en centimes.")
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const organe = await organeDans(tx, ctx.teamId, organeId)
    if (donnees.prestataireContactId) {
      const prestataire = await tx.coreContact.findFirst({ where: { id: donnees.prestataireContactId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
      if (!prestataire) refus("Ce prestataire n'existe pas dans la team.")
    }
    await tx.garageWorkOrder.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId: organe.vehicleId,
        type: "reparation",
        titre: donnees.titre,
        vehicleComponentId: organe.id,
        priorite: "normale",
        statut: "prevu",
        origine: "saisie",
        coutMainOeuvreCents: donnees.coutMainOeuvreCents ?? null,
        prestataireContactId: donnees.prestataireContactId ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  })
  return id
}

export async function modifierOrdre(id: string, entree: EntreeModificationOrdre): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return modifierOrdreDans(ctx, id, entree)
}

export async function modifierOrdreDans(ctx: ContexteTeam, id: string, entree: EntreeModificationOrdre): Promise<void> {
  const donnees = schemaModificationOrdre.parse(entree)
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const ordre = await ordreDans(tx, ctx.teamId, id)
    await liensDansOrdre(tx, ctx, ordre.vehicleId, donnees)
    await tx.garageWorkOrder.updateMany({
      where: { id, teamId: ctx.teamId, deletedAt: null },
      data: { ...donnees, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
}

export async function affecterOrdre(id: string, personIds: string[]): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return affecterOrdreDans(ctx, id, personIds)
}

export async function affecterOrdreDans(ctx: ContexteTeam, id: string, personIds: string[]): Promise<void> {
  const donnees = z.array(z.string().min(1)).parse(personIds)
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await ordreDans(tx, ctx.teamId, id)
    await personnesDans(tx, ctx.teamId, donnees)
    await affecterDans(tx, ctx, id, Array.from(new Set(donnees)))
  })
}

// Avancement et statut « prévu » ou « en cours » : l'assistance y est admise sur ses ordres affectés.
export async function avancerOrdre(id: string, pct: number): Promise<void> {
  const { ctx, niveau } = await accesGarage("contribution")
  return avancerOrdreDans(ctx, id, pct, niveau)
}

export async function avancerOrdreDans(ctx: ContexteTeam, id: string, pct: number, niveau: Niveau = "ecriture"): Promise<void> {
  if (!avancementValide(pct)) refus("L'avancement doit être un pourcentage entier, de 0 à 100.")
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const ordre = await ordreDans(tx, ctx.teamId, id)
    if (!statutModifiable(ordre.statut)) refus("Cet ordre est terminé : son avancement ne bouge plus.")
    if (!aAuMoins(niveau, "ecriture")) await verifierAffecte(tx, ctx, id)
    await tx.garageWorkOrder.updateMany({
      where: { id, teamId: ctx.teamId, deletedAt: null, statut: { not: "termine" } },
      data: { avancementPct: pct, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
}

export async function changerStatutOrdre(id: string, statut: "prevu" | "en_cours"): Promise<void> {
  const { ctx, niveau } = await accesGarage("contribution")
  return changerStatutOrdreDans(ctx, id, statut, niveau)
}

export async function changerStatutOrdreDans(ctx: ContexteTeam, id: string, statut: "prevu" | "en_cours", niveau: Niveau = "ecriture"): Promise<void> {
  if (statut !== "prevu" && statut !== "en_cours") refus("Ce statut ne se choisit pas ici : la fin d'un ordre passe par « Terminer ».")
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const ordre = await ordreDans(tx, ctx.teamId, id)
    if (!statutModifiable(ordre.statut)) refus("Cet ordre est terminé : son statut ne change plus.")
    if (!aAuMoins(niveau, "ecriture")) await verifierAffecte(tx, ctx, id)
    await tx.garageWorkOrder.updateMany({
      where: { id, teamId: ctx.teamId, deletedAt: null, statut: { not: "termine" } },
      data: { statut, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
}

// Coût de main-d'œuvre et prestataire : écriture seulement, jamais dans le paquet de l'assistance.
export async function modifierCoutOrdre(id: string, entree: EntreeCout): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return modifierCoutOrdreDans(ctx, id, entree)
}

export async function modifierCoutOrdreDans(ctx: ContexteTeam, id: string, entree: EntreeCout): Promise<void> {
  const donnees = schemaCout.parse(entree)
  if (!coutValide(donnees.coutMainOeuvreCents)) refus("Le coût doit être un montant positif, en centimes.")
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const ordre = await ordreDans(tx, ctx.teamId, id)
    if (!statutModifiable(ordre.statut)) refus("Cet ordre est terminé : son coût ne se modifie plus.")
    if (donnees.prestataireContactId) {
      const prestataire = await tx.coreContact.findFirst({ where: { id: donnees.prestataireContactId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
      if (!prestataire) refus("Ce prestataire n'existe pas dans la team.")
    }
    await tx.garageWorkOrder.updateMany({
      where: { id, teamId: ctx.teamId, deletedAt: null },
      data: { coutMainOeuvreCents: donnees.coutMainOeuvreCents, prestataireContactId: donnees.prestataireContactId, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
}

// Pièces de l'ordre : choisies dans le stock du véhicule. Ajouter ou retirer ne pose rien ; la pose ne se fait qu'à la fin.
export async function ajouterPieceOrdre(workOrderId: string, partId: string): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return ajouterPieceOrdreDans(ctx, workOrderId, partId)
}

export async function ajouterPieceOrdreDans(ctx: ContexteTeam, workOrderId: string, partId: string): Promise<void> {
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const ordre = await ordreDans(tx, ctx.teamId, workOrderId)
    if (!statutModifiable(ordre.statut)) refus("Cet ordre est terminé : ses pièces ne changent plus.")
    const piece = await pieceDans(tx, ctx.teamId, partId)
    if (piece.vehicleId !== ordre.vehicleId) refus("Cette pièce est sur une autre voiture.")
    const lien = await tx.garageWorkOrderPart.findFirst({ where: { workOrderId, partId, teamId: ctx.teamId }, select: { id: true, deletedAt: true } })
    if (lien && !lien.deletedAt) refus("Cette pièce est déjà sur cet ordre.")
    if (lien) {
      await tx.garageWorkOrderPart.updateMany({ where: { id: lien.id, teamId: ctx.teamId }, data: { deletedAt: null, rev: { increment: 1 }, updatedBy: ctx.userId } })
    } else {
      await tx.garageWorkOrderPart.create({ data: { id: newId(), teamId: ctx.teamId, workOrderId, partId, createdBy: ctx.userId, updatedBy: ctx.userId } })
    }
  })
}

export async function retirerPieceOrdre(workOrderId: string, partId: string): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return retirerPieceOrdreDans(ctx, workOrderId, partId)
}

export async function retirerPieceOrdreDans(ctx: ContexteTeam, workOrderId: string, partId: string): Promise<void> {
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const ordre = await ordreDans(tx, ctx.teamId, workOrderId)
    if (!statutModifiable(ordre.statut)) refus("Cet ordre est terminé : ses pièces ne changent plus.")
    await tx.garageWorkOrderPart.updateMany({
      where: { workOrderId, partId, teamId: ctx.teamId, deletedAt: null },
      data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
}

// Fin d'un ordre (D1, D2, D3, D7). Transaction : passage à terminé (une seule fois), puis, pour un remplacement, la pose
// de la pièce sur son organe, avec le motif de dépose de la pièce en place. Les événements partent après la transaction.
// Options de fin : le motif de dépose, et l'état de la pièce après réparation (954 v1.3, §4) quand l'ordre est une
// réparation sur un organe avec pièce montée.
export type OptionsFin = { motifDepose?: (typeof MOTIFS)[number] | null; etatApresPct?: number | null }

export async function terminerOrdre(id: string, options: OptionsFin = {}): Promise<void> {
  const { ctx, niveau } = await accesGarage("contribution")
  return terminerOrdreDans(ctx, id, options, niveau)
}

const MESSAGE_ETAT_REQUIS = "Indiquez l'état de la pièce après réparation, en pourcentage de 0 à 100."

// Pose active d'un organe, avec les cumuls de la pièce : la base de la saisie après réparation. Null sans pièce montée.
async function pieceMonteeDans(tx: Tx, teamId: string, vehicleComponentId: string) {
  const pose = await tx.garagePartMount.findFirst({
    where: { vehicleComponentId, teamId, deposeeLe: null, deletedAt: null },
    select: { partId: true, part: { select: { kmCumules: true, epreuvesCumulees: true } } },
  })
  return pose ? { partId: pose.partId, kmCumules: pose.part.kmCumules, epreuvesCumulees: pose.part.epreuvesCumulees } : null
}

export async function terminerOrdreDans(
  ctx: ContexteTeam,
  id: string,
  options: OptionsFin = {},
  niveau: Niveau = "ecriture",
): Promise<void> {
  const motif = options.motifDepose ?? null
  if (motif !== null && !MOTIFS.includes(motif)) refus("Motif de dépose inconnu.")

  const { ordre, pieces, organe } = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const ordreLu = await ordreDans(tx, ctx.teamId, id)
    const piecesLiees = await tx.garageWorkOrderPart.findMany({
      where: { workOrderId: id, teamId: ctx.teamId, deletedAt: null },
      select: { partId: true, part: { select: { componentTypeId: true } } },
    })
    const organeLu = ordreLu.vehicleComponentId
      ? await tx.garageVehicleComponent.findFirst({ where: { id: ordreLu.vehicleComponentId, teamId: ctx.teamId, deletedAt: null }, select: { id: true, componentTypeId: true } })
      : null
    return { ordre: ordreLu, pieces: piecesLiees, organe: organeLu }
  })

  if (ordre.statut === "termine") refus("Cet ordre est déjà terminé.")
  if (pieces.length > 0 && !aAuMoins(niveau, "ecriture")) refus("Terminer un ordre avec une pièce demande le niveau écriture.")

  // Remplacement : la pièce de l'organe (de son type) est posée. Une seule à la fois, sinon la pose est ambiguë.
  const poses = ordre.type === "remplacement" && organe ? pieces.filter((piece) => piece.part.componentTypeId === organe.componentTypeId) : []
  if (poses.length > 1) refus("Un remplacement pose une seule pièce : retirez les autres pièces de l'ordre.")

  await ecrireEtEmettre(ctx, ordre.vehicleId, async (tx) => {
    if (!aAuMoins(niveau, "ecriture")) await verifierAffecte(tx, ctx, id)
    // Réparation d'un organe avec pièce montée : l'état de la pièce après réparation se saisit à la clôture (954 v1.3, §4).
    const montee = ordre.type === "reparation" && organe ? await pieceMonteeDans(tx, ctx.teamId, organe.id) : null
    const etatApres = options.etatApresPct ?? null
    if (montee && (etatApres === null || !etatSaisiValide(etatApres))) refus(MESSAGE_ETAT_REQUIS)
    const fin = await tx.garageWorkOrder.updateMany({
      where: { id, teamId: ctx.teamId, deletedAt: null, statut: { not: "termine" } },
      data: { statut: "termine", avancementPct: 100, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    if (fin.count === 0) refus("Cet ordre est déjà terminé.")
    if (montee && etatApres !== null) {
      await tx.garagePartEtat.create({
        data: {
          id: newId(),
          teamId: ctx.teamId,
          partId: montee.partId,
          workOrderId: id,
          etatPct: etatApres,
          kmAuSaisie: montee.kmCumules,
          epreuvesAuSaisie: montee.epreuvesCumulees,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    }
    if (organe && poses.length === 1) {
      await poserPieceTx(tx, ctx, newId(), organe.id, poses[0].partId, motif)
    }
  })

  // D7 : les événements partent après la transaction. Un échec est journalisé, il n'annule pas la fin.
  await emettreSansBloquer(ctx, "garage.travail_termine", chargeTravailTermine.parse({ workOrderId: id, vehicleId: ordre.vehicleId, type: ordre.type }))
  if (ordre.coutMainOeuvreCents && ordre.coutMainOeuvreCents > 0) {
    await emettreSansBloquer(
      ctx,
      "garage.intervention_facturee",
      chargeInterventionFacturee.parse({
        workOrderId: id,
        vehicleId: ordre.vehicleId,
        coutCents: ordre.coutMainOeuvreCents,
        devise: ordre.devise,
        prestataireContactId: ordre.prestataireContactId,
      }),
    )
  }
}

async function emettreSansBloquer(ctx: ContexteTeam, nom: string, charge: Record<string, unknown>): Promise<void> {
  try {
    await emettre(ctx, nom, charge)
  } catch (erreur) {
    console.error(`[garage] ${nom} non émis :`, erreur instanceof Error ? erreur.message : "erreur inconnue")
  }
}

// --- Intervention rapide (tâche 4.3, brief §4, D5) ---------------------------------------------
// Un ordre déjà terminé, affecté à la personne qui saisit. Sans pièce : type réparation, la contribution suffit (l'assistance
// comprise). Avec une pièce : type remplacement, la pose se fait dans la même transaction (D1), et la pièce demande le
// niveau écriture (D2). « Ce qui a été fait » est le titre de l'ordre.

const schemaIntervention = z
  .object({
    vehicleComponentId: z.string().min(1, "Choisissez l'organe."),
    titre: z.string().trim().min(1, "Dites ce qui a été fait.").max(200),
    partId: z.string().min(1).nullable().optional(),
    motifDepose: z.enum(MOTIFS).nullable().optional(),
  })
  .strict()

export type EntreeIntervention = z.input<typeof schemaIntervention>

export async function creerIntervention(vehicleId: string, entree: EntreeIntervention): Promise<string> {
  const donnees = schemaIntervention.parse(entree)
  const { ctx, niveau } = await accesGarage(donnees.partId ? "ecriture" : "contribution")
  return creerInterventionDans(ctx, vehicleId, donnees, niveau)
}

export async function creerInterventionDans(
  ctx: ContexteTeam,
  vehicleId: string,
  entree: EntreeIntervention,
  niveau: Niveau = "ecriture",
): Promise<string> {
  const donnees = schemaIntervention.parse(entree)
  if (donnees.partId && !aAuMoins(niveau, "ecriture")) refus("Pour utiliser une pièce, il faut le niveau écriture.")
  const id = newId()
  const partId = donnees.partId ?? null

  await ecrireEtEmettre(ctx, vehicleId, async (tx) => {
    await vehiculeDans(tx, ctx.teamId, vehicleId)
    const organe = await organeDans(tx, ctx.teamId, donnees.vehicleComponentId)
    if (organe.vehicleId !== vehicleId) refus("Cet organe n'est pas sur ce véhicule.")
    const personneId = await personneDuCompte(tx, ctx)
    if (!personneId) refus("Votre compte n'a pas de fiche personne dans la team : le responsable doit la créer.")

    await tx.garageWorkOrder.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId,
        type: partId ? "remplacement" : "reparation",
        titre: donnees.titre,
        vehicleComponentId: organe.id,
        priorite: "normale",
        statut: "termine",
        avancementPct: 100,
        origine: "saisie",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await tx.garageWorkOrderPerson.create({
      data: { id: newId(), teamId: ctx.teamId, workOrderId: id, personId: personneId, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
    if (partId) {
      await tx.garageWorkOrderPart.create({
        data: { id: newId(), teamId: ctx.teamId, workOrderId: id, partId, createdBy: ctx.userId, updatedBy: ctx.userId },
      })
      await poserPieceTx(tx, ctx, newId(), organe.id, partId, donnees.motifDepose ?? null)
    }
  })

  // D7 : événement après la transaction, un échec est journalisé sans annuler l'intervention.
  await emettreSansBloquer(ctx, "garage.travail_termine", chargeTravailTermine.parse({ workOrderId: id, vehicleId, type: partId ? "remplacement" : "reparation" }))
  return id
}

// --- Commandes (tâche 4.3, brief §5, D6) ----------------------------------------------------
// Écriture seulement (accesGarage « ecriture »). La réception passe à « reçue » une seule fois : le statut est verrouillé
// par updateMany avant la création des pièces, dans la même transaction. Une pièce par unité, en stock, avec le prix et le
// fournisseur. L'événement part après la transaction (D7).

const dateCivile = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez une date (AAAA-MM-JJ).")

const schemaLigneCommande = z
  .object({
    designation: z.string().trim().min(1, "Désignez la pièce.").max(200),
    componentTypeId: z.string().min(1, "Choisissez l'organe de la pièce."),
    reference: texte(100),
    quantite: z.number().int("La quantité doit être un nombre entier.").min(1).max(50),
    prixUnitaireCents: z.number().int().min(0),
    qualite: z.enum(QUALITES).default("origine"),
  })
  .strict()

const schemaCommande = z
  .object({
    supplierContactId: z.string().min(1, "Choisissez le fournisseur."),
    commandeeLe: dateCivile,
    livraisonPrevueLe: dateCivile.nullable().optional(),
    lignes: z.array(schemaLigneCommande).min(1, "Ajoutez au moins une ligne.").max(10),
  })
  .strict()

export type EntreeCommande = z.input<typeof schemaCommande>

async function fournisseurDans(tx: Tx, teamId: string, id: string): Promise<void> {
  const fournisseur = await tx.coreContact.findFirst({ where: { id, teamId, deletedAt: null }, select: { id: true } })
  if (!fournisseur) refus("Ce fournisseur n'existe pas dans la team.")
}

export async function creerCommande(vehicleId: string, entree: EntreeCommande): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return creerCommandeDans(ctx, vehicleId, entree)
}

export async function creerCommandeDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeCommande): Promise<string> {
  const donnees = schemaCommande.parse(entree)
  const id = newId()
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await vehiculeDans(tx, ctx.teamId, vehicleId)
      await fournisseurDans(tx, ctx.teamId, donnees.supplierContactId)
      for (const ligne of donnees.lignes) await typeDansTeam(tx, ctx.teamId, ligne.componentTypeId)
      await tx.garagePurchase.create({
        data: {
          id,
          teamId: ctx.teamId,
          vehicleId,
          supplierContactId: donnees.supplierContactId,
          statut: "commandee",
          commandeeLe: new Date(donnees.commandeeLe),
          livraisonPrevueLe: donnees.livraisonPrevueLe ? new Date(donnees.livraisonPrevueLe) : null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      await tx.garagePurchaseLine.createMany({
        data: donnees.lignes.map((ligne) => ({
          id: newId(),
          teamId: ctx.teamId,
          purchaseId: id,
          designation: ligne.designation,
          reference: ligne.reference ?? null,
          quantite: ligne.quantite,
          prixUnitaireCents: ligne.prixUnitaireCents,
          devise: "EUR",
          componentTypeId: ligne.componentTypeId,
          qualite: ligne.qualite,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      })
    }),
  )
  return id
}

export async function expedierCommande(id: string): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return expedierCommandeDans(ctx, id)
}

export async function expedierCommandeDans(ctx: ContexteTeam, id: string): Promise<void> {
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const commande = await tx.garagePurchase.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { statut: true } })
      if (!commande) refus("Commande introuvable.")
      if (!receptionPossible(commande.statut)) refus("Cette commande est déjà reçue.")
      if (commande.statut === "expediee") refus("Cette commande est déjà expédiée.")
      await tx.garagePurchase.updateMany({
        where: { id, teamId: ctx.teamId, deletedAt: null, statut: "commandee" },
        data: { statut: "expediee", rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    }),
  )
}

export async function recevoirCommande(id: string): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  await recevoirCommandeDans(ctx, id)
}

// Réception : une transaction. Le verrou sur le statut (updateMany « pas encore reçue ») passe avant tout le reste : une
// seconde réception concurrente ne voit aucune ligne et ne crée rien. Une ligne sans organe bloque la réception.
// Renvoie les identifiants des pièces créées, une par unité : Remplacer s'en sert pour poser la pièce achetée.
export async function recevoirCommandeDans(ctx: ContexteTeam, id: string): Promise<string[]> {
  const recueLe = new Date()
  const bilan = await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const commande = await tx.garagePurchase.findFirst({
        where: { id, teamId: ctx.teamId, deletedAt: null },
        select: { vehicleId: true, supplierContactId: true, statut: true },
      })
      if (!commande) refus("Commande introuvable.")
      if (!receptionPossible(commande.statut)) refus("Cette commande est déjà reçue.")

      const fin = await tx.garagePurchase.updateMany({
        where: { id, teamId: ctx.teamId, deletedAt: null, statut: { not: "recue" } },
        data: { statut: "recue", recueLe, rev: { increment: 1 }, updatedBy: ctx.userId },
      })
      if (fin.count === 0) refus("Cette commande est déjà reçue.")

      const lignes = await tx.garagePurchaseLine.findMany({
        where: { purchaseId: id, teamId: ctx.teamId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      })
      const pieces: Prisma.GaragePartCreateManyInput[] = []
      const idsPieces: string[] = []
      const idPiece = () => {
        const idNouvelle = newId()
        idsPieces.push(idNouvelle)
        return idNouvelle
      }
      let totalCents = 0
      for (const ligne of lignes) {
        if (!ligne.componentTypeId) refus(`La ligne « ${ligne.designation} » n'a pas d'organe : complétez-la avant la réception.`)
        totalCents += ligne.quantite * ligne.prixUnitaireCents
        for (let unite = 0; unite < ligne.quantite; unite += 1) {
          pieces.push({
            id: idPiece(),
            teamId: ctx.teamId,
            vehicleId: commande.vehicleId,
            componentTypeId: ligne.componentTypeId,
            designation: ligne.designation,
            reference: ligne.reference,
            qualite: ligne.qualite,
            prixCents: ligne.prixUnitaireCents,
            devise: ligne.devise,
            fournisseurContactId: commande.supplierContactId,
            statut: "en_stock",
            acheteeLe: recueLe,
            commandeLigneId: ligne.id,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
        }
      }
      if (pieces.length > 0) await tx.garagePart.createMany({ data: pieces })
      return {
        vehicleId: commande.vehicleId,
        supplierContactId: commande.supplierContactId,
        totalCents,
        devise: lignes[0]?.devise ?? "EUR",
        idsPieces,
      }
    }),
  )

  // D7 : l'événement part après la transaction. Une commande à zéro n'ouvre pas de dépense côté Budget.
  if (bilan.totalCents > 0) {
    await emettreSansBloquer(
      ctx,
      "garage.piece_achetee",
      chargePieceAchetee.parse({
        purchaseId: id,
        vehicleId: bilan.vehicleId,
        supplierContactId: bilan.supplierContactId,
        totalCents: bilan.totalCents,
        devise: bilan.devise,
        recueLe: recueLe.toISOString(),
      }),
    )
  }
  return bilan.idsPieces
}
