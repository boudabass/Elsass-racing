// Widgets de Budget (tâche 2.7, section 6) : trois lectures, sans affichage (le Tableau de bord arrive au
// lot 6). Chaque lecture a sa variante « …Dans(ctx) » pour être testée en base, comme celles de Saison.
// Sans accès, un widget renvoie null (rien plutôt qu'un chiffre qui ne revient pas au membre).

import { ErreurAcces } from "@/core/droits/erreurs"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { lirePrevisionnel, lireSoldeMoi, compterSuggestions } from "./lectures-serveur"
import { ecartPrevisionnel, type Couleur } from "./regles"
import { jourDeParis } from "@/core/dates"
import { accesBudget } from "./services-serveur"

export interface WidgetSaisonPrevisionnel {
  annee: number
  prevuCentimes: number | null
  reelCentimes: number
  couleur: Couleur | null
}

// Saison en cours contre prévisionnel : prévu de la saison (sans épreuve), réel confirmé, couleur d'écart.
export async function widgetSaisonContrePrevisionnelDans(ctx: ContexteTeam): Promise<WidgetSaisonPrevisionnel | null> {
  const aujourdhui = new Date(`${jourDeParis(new Date())}T00:00:00Z`)
  const saison = await prismaPourTeam(ctx.teamId, ctx.userId).coreSeason.findFirst({
    where: { teamId: ctx.teamId, deletedAt: null, dateDebut: { lte: aujourdhui }, dateFin: { gte: aujourdhui } },
    select: { id: true, annee: true },
  })
  if (!saison) return null
  const lignes = await lirePrevisionnelDans(ctx, saison.id)
  const prevu = lignes.reduce<number | null>((total, ligne) => (ligne.prevu === null ? total : (total ?? 0) + ligne.prevu), null)
  const reel = lignes.reduce((total, ligne) => total + ligne.reel, 0)
  return {
    annee: saison.annee,
    prevuCentimes: prevu,
    reelCentimes: reel,
    couleur: prevu === null ? (reel > 0 ? "rouge" : null) : ecartPrevisionnel(prevu, reel).couleur,
  }
}

// Le prévisionnel lu avec le contexte donné (les lectures publiques passent par accesBudget).
async function lirePrevisionnelDans(ctx: ContexteTeam, saisonId: string) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [categories, previsions, depenses] = await Promise.all([
    client.budgetCategory.findMany({ where: { teamId: ctx.teamId, sens: "depense", active: true, deletedAt: null }, select: { id: true } }),
    client.budgetForecast.findMany({ where: { teamId: ctx.teamId, seasonId: saisonId, eventId: null, deletedAt: null }, select: { categoryId: true, montant: true } }),
    client.budgetExpense.findMany({ where: { teamId: ctx.teamId, seasonId: saisonId, confirmee: true, deletedAt: null }, select: { categoryId: true, montant: true } }),
  ])
  return categories.map((categorie) => {
    const prevu = previsions.find((prevision) => prevision.categoryId === categorie.id)?.montant ?? null
    const reel = depenses.filter((depense) => depense.categoryId === categorie.id).reduce((total, depense) => total + depense.montant, 0)
    return { prevu, reel }
  })
}

export async function widgetSaisonContrePrevisionnel(): Promise<WidgetSaisonPrevisionnel | null> {
  try {
    const { ctx } = await accesBudget("lecture")
    return widgetSaisonContrePrevisionnelDans(ctx)
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) return null
    throw erreur
  }
}

// Mon solde : ce que la team me doit, moins un éventuel trop-perçu.
export async function widgetMonSolde(): Promise<{ du: number; trop: number } | null> {
  try {
    return await lireSoldeMoi()
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) return null
    throw erreur
  }
}

// Mouvements à confirmer : nombre de suggestions en attente (écriture requise, sinon null).
export async function widgetMouvementsAConfirmerDans(ctx: ContexteTeam): Promise<number> {
  return prismaPourTeam(ctx.teamId, ctx.userId).budgetSuggestion.count({ where: { teamId: ctx.teamId, statut: "en_attente", deletedAt: null } })
}

export async function widgetMouvementsAConfirmer(): Promise<number | null> {
  try {
    return await compterSuggestions()
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) return null
    throw erreur
  }
}
