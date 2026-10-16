// Lectures serveur de Budget (tâche 2.5). Le filtrage de contribution est fait ici, côté serveur :
// un composant ne reçoit jamais une dépense qui n'est pas la sienne au niveau contribution.

import { prismaPourTeam } from "@/lib/prisma"

import { accesBudget, personneDuMembreDans } from "./services-serveur"
import { depensesVisibles, soldeMembre } from "./regles"

export interface DepenseLue {
  id: string
  date: string
  montant: number
  libelle: string
  categoryId: string
  payerId: string
  personneId: string | null
  confirmee: boolean
  aRembourser: boolean
  remboursement: string
}

// Dépenses lisibles par l'appelant : toutes à partir de l'écriture, seulement les siennes en dessous.
export async function lireDepenses(): Promise<DepenseLue[]> {
  const { ctx, niveau } = await accesBudget("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const moi = await personneDuMembreDans(ctx)
  const lignes = await client.budgetExpense.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    orderBy: [{ date: "desc" }, { id: "asc" }],
    include: { payer: { select: { personId: true } } },
  })
  const depenses: DepenseLue[] = lignes.map((ligne) => ({
    id: ligne.id,
    date: ligne.date.toISOString().slice(0, 10),
    montant: ligne.montant,
    libelle: ligne.libelle,
    categoryId: ligne.categoryId,
    payerId: ligne.payerId,
    personneId: ligne.payer.personId,
    confirmee: ligne.confirmee,
    aRembourser: ligne.aRembourser,
    remboursement: ligne.remboursement,
  }))
  return depensesVisibles(depenses, niveau, moi)
}

// Solde de l'appelant : ce que la team lui doit, et un éventuel trop-perçu à signaler.
export async function lireSoldeMoi(): Promise<{ du: number; trop: number } | null> {
  const { ctx } = await accesBudget("lecture")
  const moi = await personneDuMembreDans(ctx)
  if (moi === null) return null
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const depenses = await client.budgetExpense.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { montant: true, confirmee: true, aRembourser: true, payer: { select: { personId: true } } },
  })
  const remboursements = await client.budgetReimbursement.findMany({
    where: { teamId: ctx.teamId, personId: moi, deletedAt: null },
    select: { montant: true },
  })
  return soldeMembre(
    moi,
    depenses.map((depense) => ({ montant: depense.montant, confirmee: depense.confirmee, aRembourser: depense.aRembourser, personneId: depense.payer.personId })),
    remboursements.map((remboursement) => ({ personneId: moi, montant: remboursement.montant })),
  )
}
