// Services serveur des trains de pneus (tâche 4.4, brief §2). Même forme que services-serveur.ts : chaque fonction publique
// passe par accesGarage(niveau) ; les fonctions « …Dans(ctx, …) » font le travail sans garde.

import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { newId } from "@/core/ids"
import { executerPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { ErreurGarage, refus } from "./erreurs"
import { LIBELLES_TYPE_PNEUS, separerDateAchat, statutPneusValide, trainDeLaVoiture, usureValide, validerSaisieTrain, type EntreeTrain, type StatutPneus } from "./pneus"
import { prixImposeFournisseur } from "./regles"
import { accesGarage, creerCommandeDans, expedierCommandeDans, recevoirCommandeDans, type TrainAchete } from "./services-serveur"

export { ErreurGarage }

const dateCivile = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue : AAAA-MM-JJ.")

export type { EntreeTrain }

function trainSaisi(entree: EntreeTrain): TrainAchete {
  const valide = validerSaisieTrain(entree)
  if ("erreur" in valide) refus(valide.erreur)
  return valide.train
}

// Date civile du jour à Paris, « AAAA-MM-JJ ».
const jourParis = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

// --- Ajout sans prix : le train entre à la team, non monté, sans commande ni événement -----------------------------

export async function ajouterTrain(vehicleId: string, entree: EntreeTrain & { acheteLe?: string | null }): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return ajouterTrainDans(ctx, vehicleId, entree)
}

export async function ajouterTrainDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeTrain & { acheteLe?: string | null }): Promise<string> {
  const { saisie, acheteLe: acheteLeSaisie } = separerDateAchat(entree)
  const train = trainSaisi(saisie)
  const acheteLe = acheteLeSaisie ? dateCivile.parse(acheteLeSaisie) : null
  const id = newId()
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const voiture = await tx.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
      if (!voiture) refus("Cette voiture n'existe pas dans la team.")
      await tx.garageTyreSet.create({
        data: {
          id,
          teamId: ctx.teamId,
          vehicleId,
          vehicleComponentId: null,
          marque: train.marque,
          modele: train.modele,
          gomme: train.gomme,
          type: train.type,
          dimensions: train.dimensions,
          acheteLe: acheteLe ? new Date(acheteLe) : null,
          statut: "neuf",
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    }),
  )
  return id
}

// --- Ajout avec prix : une commande saisie, expédiée et reçue tout de suite, comme Remplacer (954 §2) ----------------

export interface EntreeTrainAchete {
  train: EntreeTrain
  fournisseurContactId: string | null
  prixCents: number | null
  quantite?: number
}

// Un train acheté avec un prix passe par une commande, pour que garage.piece_achetee parte vers le Budget. Sans prix, le
// train est créé directement (ajouterTrainDans). La seule voie qui crée une ligne Pneus est cet achat (achatTrain).
export async function ajouterTrainAchete(vehicleId: string, entree: EntreeTrainAchete): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return ajouterTrainAcheteDans(ctx, vehicleId, entree)
}

export async function ajouterTrainAcheteDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeTrainAchete): Promise<string> {
  const train = trainSaisi(entree.train)
  if (entree.prixCents === null) return ajouterTrainDans(ctx, vehicleId, { ...entree.train, acheteLe: null })

  const refusPrix = prixImposeFournisseur(entree.prixCents, entree.fournisseurContactId)
  if (refusPrix) refus(refusPrix)
  if (!entree.fournisseurContactId) refus("Choisis le fournisseur du train.")

  const typePneus = await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.garageComponentType.findFirst({ where: { teamId: ctx.teamId, cle: "pneus", deletedAt: null }, select: { id: true } }),
  )
  if (!typePneus) refus("L'organe Pneus n'existe pas dans la team.")

  const commandeId = await creerCommandeDans(
    ctx,
    vehicleId,
    {
      supplierContactId: entree.fournisseurContactId,
      commandeeLe: jourParis(),
      lignes: [
        {
          designation: `Train de pneus ${LIBELLES_TYPE_PNEUS[train.type]}`,
          componentTypeId: typePneus.id,
          reference: null,
          quantite: entree.quantite ?? 1,
          prixUnitaireCents: entree.prixCents,
          qualite: "origine",
        },
      ],
    },
    { achatTrain: true },
  )
  await expedierCommandeDans(ctx, commandeId)
  await recevoirCommandeDans(ctx, commandeId, train)
  return commandeId
}

// --- Montage : un seul train monté par organe Pneus, le précédent est démonté dans la même transaction ---------------

export async function monterTrain(tyreSetId: string, vehicleComponentId: string): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return monterTrainDans(ctx, tyreSetId, vehicleComponentId)
}

export async function monterTrainDans(ctx: ContexteTeam, tyreSetId: string, vehicleComponentId: string): Promise<void> {
  try {
    await avecReprisePourConflit(() =>
      executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
        const train = await tx.garageTyreSet.findFirst({
          where: { id: tyreSetId, teamId: ctx.teamId, deletedAt: null },
          select: { vehicleId: true, vehicleComponentId: true },
        })
        if (!train) refus("Ce train n'existe pas dans la team.")
        const organe = await tx.garageVehicleComponent.findFirst({
          where: { id: vehicleComponentId, teamId: ctx.teamId, deletedAt: null },
          select: { vehicleId: true, componentType: { select: { cle: true } } },
        })
        if (!organe || organe.componentType.cle !== "pneus") refus("Le train se monte sur l'organe Pneus de la voiture.")
        const refusVoiture = trainDeLaVoiture(train.vehicleId, organe.vehicleId)
        if (refusVoiture) refus(refusVoiture)
        if (train.vehicleComponentId === vehicleComponentId) refus("Ce train est déjà monté.")

        // Le train en place part sans destination : un train démonté reste à la team [Orch 24/10].
        await tx.garageTyreSet.updateMany({
          where: { teamId: ctx.teamId, vehicleComponentId, deletedAt: null },
          data: { vehicleComponentId: null, rev: { increment: 1 }, updatedBy: ctx.userId },
        })
        await tx.garageTyreSet.updateMany({
          where: { id: tyreSetId, teamId: ctx.teamId, deletedAt: null },
          data: { vehicleComponentId, rev: { increment: 1 }, updatedBy: ctx.userId },
        })
      }),
    )
  } catch (erreur) {
    // Deux montages simultanés : l'index unique « un seul train monté » refuse le second, sans l'écrire.
    if (typeof erreur === "object" && erreur !== null && "code" in erreur && erreur.code === "P2002") {
      refus("Un autre train vient d'être monté sur cet organe : rechargez l'écran.")
    }
    throw erreur
  }
}

// --- Usure estimée et statut, saisis à la main (correction C) -------------------------------------------------------

export async function saisirUsureTrain(tyreSetId: string, entree: { usureEstimeePct: number; statut: string }): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return saisirUsureTrainDans(ctx, tyreSetId, entree)
}

export async function saisirUsureTrainDans(
  ctx: ContexteTeam,
  tyreSetId: string,
  entree: { usureEstimeePct: number; statut: string },
): Promise<void> {
  const erreurUsure = usureValide(entree.usureEstimeePct)
  if (erreurUsure) refus(erreurUsure)
  if (!statutPneusValide(entree.statut)) refus("Ce statut de pneus n'existe pas.")
  const statut: StatutPneus = entree.statut
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const { count } = await tx.garageTyreSet.updateMany({
        where: { id: tyreSetId, teamId: ctx.teamId, deletedAt: null },
        data: { usureEstimeePct: entree.usureEstimeePct, statut, rev: { increment: 1 }, updatedBy: ctx.userId },
      })
      if (count === 0) refus("Ce train n'existe pas dans la team.")
    }),
  )
}
