// Origine des justificatifs de Budget pour « Tous les fichiers » (tâche 5.4). Une dépense ne se voit que selon la règle de
// Budget (depensesVisibles) : sans accès à Budget, rien ; la lecture et l'écriture voient tout ; la contribution, ses dépenses.
import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import type { FicheOrigine, OrigineFichier } from "@/core/fichiers/types-origine"
import { prismaPourTeam } from "@/lib/prisma"

import { depensesVisibles } from "./regles"

async function personneDuMembre(ctx: ContexteTeam): Promise<string | null> {
  const membre = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findFirst({
    where: { id: ctx.membership.id, teamId: ctx.teamId, deletedAt: null },
    select: { personId: true },
  })
  return membre?.personId ?? null
}

export const origineDepensesBudget: OrigineFichier = {
  app: "budget",
  ficheType: "expense",

  async fichesVisibles(ctx, ids) {
    if (ids.length === 0) return []
    const niveau = await niveauDe(ctx, "budget")
    if (niveau === "aucun") return []
    const depenses = await prismaPourTeam(ctx.teamId, ctx.userId).budgetExpense.findMany({
      where: { teamId: ctx.teamId, id: { in: [...ids] }, deletedAt: null },
      select: { id: true, libelle: true, payer: { select: { personId: true } } },
    })
    const visibles = depensesVisibles(
      depenses.map((depense) => ({ ...depense, personneId: depense.payer.personId })),
      niveau,
      await personneDuMembre(ctx),
    )
    return visibles.map((depense): FicheOrigine => ({ id: depense.id, libelle: depense.libelle, chemin: `/apps/budget/mouvement/${depense.id}` }))
  },
}
