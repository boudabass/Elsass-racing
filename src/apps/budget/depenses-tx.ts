// Modification et suppression d'une dépense ou d'une recette (tâche 2.7, section 0). Une seule règle pour
// le chemin en ligne (executerPourTeam) et pour la synchro (registre) : la transaction est celle de l'appelant.
//
// Règles : écriture = tout mouvement ; sans écriture (contribution), seulement les dépenses dont le payeur
// est sa personne. Une dépense remboursée ne descend pas sous ce qui a été remboursé, ne change pas de
// payeur, et ne se supprime pas.

import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import type { Tx } from "@/core/synchro/registre"

import { refus, eurosPourMessage } from "./erreurs"
import { aRembourser, statutRemboursement, type TypePayeur } from "./regles"

export interface DonneesDepenseModifiee {
  montant: number
  categoryId: string
  libelle: string
  payerId: string
  date: Date
  eventId: string | null
  entryId: string | null
  seasonId: string | null
  moyen: "carte" | "especes" | "cheque" | "virement" | null
}

// Personne de l'appelant (son membership), ou null.
async function personneDe(tx: Tx, ctx: ContexteTeam): Promise<string | null> {
  const membre = await tx.coreMembership.findFirst({ where: { id: ctx.membership.id, teamId: ctx.teamId }, select: { personId: true } })
  return membre?.personId ?? null
}

// Renvoie les personnes à prévenir (solde) : celle de l'ancien payeur et celle du nouveau, si ce sont des membres.
export async function modifierDepenseTx(
  tx: Tx,
  ctx: ContexteTeam,
  id: string,
  donnees: DonneesDepenseModifiee,
  niveau: Niveau,
): Promise<{ personnes: string[] }> {
  const existante = await tx.budgetExpense.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    select: {
      montant: true,
      aRembourser: true,
      payerId: true,
      payer: { select: { personId: true } },
      lignes: { where: { deletedAt: null }, select: { montant: true } },
    },
  })
  if (!existante) refus("Dépense introuvable dans cette team.")

  const moi = await personneDe(tx, ctx)
  if (!aAuMoins(niveau, "ecriture") && (moi === null || existante.payer.personId !== moi)) {
    refus("Tu ne peux modifier que les dépenses que tu as payées toi-même.")
  }

  const rembourse = existante.lignes.reduce((total, ligne) => total + ligne.montant, 0)
  if (donnees.montant < rembourse) {
    refus(`Le montant ne peut pas descendre sous les ${eurosPourMessage(rembourse)} déjà remboursés.`)
  }

  const payeur = await tx.budgetPayer.findFirst({
    where: { id: donnees.payerId, teamId: ctx.teamId, actif: true, deletedAt: null },
    select: { type: true, personId: true },
  })
  if (!payeur) refus("Payeur introuvable ou inactif.")
  if (!aAuMoins(niveau, "ecriture") && (payeur.type !== "membre" || payeur.personId !== moi)) {
    refus("Tu ne peux payer une dépense qu'en ton nom.")
  }
  if (rembourse > 0 && (donnees.payerId !== existante.payerId)) {
    refus("Cette dépense a déjà été remboursée : son payeur ne peut plus changer.")
  }

  const categorie = await tx.budgetCategory.findFirst({
    where: { id: donnees.categoryId, teamId: ctx.teamId, sens: "depense", active: true, deletedAt: null },
    select: { id: true },
  })
  if (!categorie) refus("Catégorie de dépense introuvable ou inactive.")

  const type: TypePayeur = payeur.type
  const estRembourse = aRembourser(type)
  const lignes = existante.lignes.map((ligne) => ligne.montant)
  await tx.budgetExpense.updateMany({
    where: { id, teamId: ctx.teamId },
    data: {
      montant: donnees.montant,
      categoryId: donnees.categoryId,
      libelle: donnees.libelle,
      payerId: donnees.payerId,
      date: donnees.date,
      eventId: donnees.eventId,
      entryId: donnees.entryId,
      seasonId: donnees.seasonId,
      moyen: donnees.moyen,
      aRembourser: estRembourse,
      remboursement: statutRemboursement({ montant: donnees.montant, aRembourser: estRembourse }, lignes),
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })

  const personnes = [existante.payer.personId, payeur.personId].filter((personne): personne is string => personne !== null)
  return { personnes: Array.from(new Set(personnes)) }
}

// Suppression douce d'une dépense. Une dépense remboursée ne se supprime pas.
export async function supprimerDepenseTx(tx: Tx, ctx: ContexteTeam, id: string, niveau: Niveau): Promise<{ personnes: string[] }> {
  const existante = await tx.budgetExpense.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    select: { payer: { select: { personId: true } }, lignes: { where: { deletedAt: null }, select: { montant: true } } },
  })
  if (!existante) refus("Dépense introuvable dans cette team.")
  const moi = await personneDe(tx, ctx)
  if (!aAuMoins(niveau, "ecriture") && (moi === null || existante.payer.personId !== moi)) {
    refus("Tu ne peux supprimer que les dépenses que tu as payées toi-même.")
  }
  if (existante.lignes.length > 0) refus("Cette dépense a déjà été remboursée : elle ne se supprime pas.")
  await tx.budgetExpense.updateMany({
    where: { id, teamId: ctx.teamId },
    data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
  })
  return { personnes: existante.payer.personId ? [existante.payer.personId] : [] }
}
