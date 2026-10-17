// Liaisons de Budget avec Saison (tâche 2.7). Une app propose, elle n'écrit jamais chez l'autre : Budget
// n'écrit que ses tables ; il reçoit saison.engagement_paye et propose une dépense ; il expose à Saison des
// lectures (dépense d'un engagement, coût de l'épreuve) et ne lit jamais les tables de Saison.
//
// Boucle évitée : une dépense confirmée pour un engagement (ou une proposition venant de Saison, origine
// saison:<entryId>) ne déclenche plus rien. Voir docs/schema-budget.md, section Liaisons.

import { jourDeParis } from "@/core/dates"
import { z } from "zod"

import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { emettre } from "@/core/evenements/bus-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { ErreurAcces } from "@/core/droits/erreurs"
import { newId } from "@/core/ids"
import { prismaPourTeam } from "@/lib/prisma"

import { ErreurBudget, refus } from "./erreurs"
import { modePaiementSaison, voitTout } from "./regles"
import { lireSoldeMoi, listerMouvements } from "./lectures-serveur"
import { accesBudget, initialiserSiBesoin, payeurDePersonneDans, PRIORITE_MOUVEMENT_A_CONFIRMER } from "./services-serveur"

// --- Saison propose un paiement : dépense d'engagement proposée (section 1) ---------------------

const schemaPaiementEngagement = z.object({
  entryId: z.string().uuid(),
  eventId: z.string().uuid(),
  montant: z.number().int().min(0),
  payeurPersonId: z.string().uuid().nullable().optional(),
})

// Un paiement d'engagement (saison.engagement_paye) : une seule proposition en attente par engagement, mise
// à jour au second paiement. Rien si une dépense d'engagement est déjà confirmée pour cet engagement.
export async function proposerDepenseEngagementDans(ctx: ContexteTeam, entree: z.input<typeof schemaPaiementEngagement>): Promise<void> {
  const donnees = schemaPaiementEngagement.parse(entree)
  if (donnees.montant <= 0) return
  await initialiserSiBesoin(ctx)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const categorie = await client.budgetCategory.findFirst({
    where: { teamId: ctx.teamId, cle: "engagement", sens: "depense", active: true, deletedAt: null },
    select: { id: true },
  })
  if (!categorie) return
  const dejaPaye = await client.budgetExpense.findFirst({
    where: { teamId: ctx.teamId, entryId: donnees.entryId, categoryId: categorie.id, confirmee: true, deletedAt: null },
    select: { id: true },
  })
  if (dejaPaye) return

  const epreuve = await client.coreEvent.findFirst({ where: { id: donnees.eventId, teamId: ctx.teamId, deletedAt: null }, select: { nom: true } })
  const payeurId = donnees.payeurPersonId
    ? await payeurDePersonneDans(ctx, donnees.payeurPersonId)
    : (await client.budgetPayer.findFirst({ where: { teamId: ctx.teamId, type: "caisse_team", deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null
  const libelle = `Engagement ${epreuve?.nom ?? ""}`.trim()

  const enAttente = await client.budgetSuggestion.findFirst({
    where: { teamId: ctx.teamId, entryId: donnees.entryId, appOrigine: "saison", statut: "en_attente", deletedAt: null },
    select: { id: true, actionCle: true },
  })
  if (enAttente) {
    await client.budgetSuggestion.updateMany({
      where: { id: enAttente.id, teamId: ctx.teamId },
      data: { montant: donnees.montant, payerId: payeurId, libelle, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    await emettreDemandeEngagement(ctx, { id: enAttente.id, actionCle: enAttente.actionCle ?? `budget_suggestion:${enAttente.id}`, libelle, eventId: donnees.eventId })
    return
  }

  const id = newId()
  const actionCle = `budget_suggestion:${id}`
  await client.budgetSuggestion.create({
    data: {
      id,
      teamId: ctx.teamId,
      appOrigine: "saison",
      evenementOrigine: "saison.engagement_paye",
      sens: "depense",
      montant: donnees.montant,
      categoryId: categorie.id,
      libelle,
      eventId: donnees.eventId,
      entryId: donnees.entryId,
      payerId: payeurId,
      statut: "en_attente",
      actionCle,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  })
  await emettreDemandeEngagement(ctx, { id, actionCle, libelle, eventId: donnees.eventId })
}

// La demande de confirmation : même clé que la suggestion, donc réémettre la met à jour sans doublon.
async function emettreDemandeEngagement(ctx: ContexteTeam, { id, actionCle, libelle, eventId }: { id: string; actionCle: string; libelle: string; eventId: string }) {
  await emettre(ctx, "budget.action_requise", {
    type: "mouvement_a_confirmer",
    cleUnicite: actionCle,
    titre: `Confirmer le mouvement : ${libelle}`,
    contexte: "Saison · paiement d'engagement",
    ficheType: "mouvement",
    ficheId: id,
    eventId,
    destinataires: { roles: ["responsable", "equipage"] },
    boutons: [
      { cle: "confirmer", libelle: "Confirmer" },
      { cle: "ignorer", libelle: "Ignorer" },
    ],
    priorite: PRIORITE_MOUVEMENT_A_CONFIRMER,
    niveauRequis: "ecriture",
    cleRegroupement: "mouvements_a_confirmer",
  })
}

// Enregistré à l'import du module : Budget reçoit les paiements d'engagements de Saison.
enregistrerGestionnaire("budget", "saison.engagement_paye", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const donnees = evenement.donnees as { entryId?: string; eventId?: string; montant_paye?: number; payeurPersonId?: string | null }
  const analyse = schemaPaiementEngagement.safeParse({
    entryId: donnees.entryId,
    eventId: donnees.eventId,
    montant: donnees.montant_paye,
    payeurPersonId: donnees.payeurPersonId ?? null,
  })
  if (!analyse.success) return
  await proposerDepenseEngagementDans(ctx, analyse.data)
})

// --- Saison marque un engagement payé : la dépense d'engagement de Budget (section 2) ----------

export interface DepenseEngagement {
  montant: number
  date: string
  payeurPersonId: string | null
  mode: "cheque" | "virement" | "en_ligne" | "especes"
}

// Dépense d'engagement confirmée la plus récente pour cet engagement. Appelée par Saison, qui ne lit pas les
// tables de Budget. Sans dépense : refus clair (la décision reste à faire).
export async function lireDepenseEngagementDans(ctx: ContexteTeam, entryId: string): Promise<DepenseEngagement> {
  const depense = await prismaPourTeam(ctx.teamId, ctx.userId).budgetExpense.findFirst({
    where: { teamId: ctx.teamId, entryId, confirmee: true, deletedAt: null, category: { cle: "engagement" } },
    orderBy: [{ date: "desc" }, { id: "asc" }],
    select: { montant: true, date: true, moyen: true, payer: { select: { personId: true } } },
  })
  if (!depense) refus("Aucune dépense d'engagement confirmée pour cet engagement.")
  return {
    montant: depense.montant,
    date: depense.date.toISOString().slice(0, 10),
    payeurPersonId: depense.payer.personId,
    mode: modePaiementSaison(depense.moyen),
  }
}


// --- Lectures exposées à Saison et au QG (sections 3, 4 et 5) ---------------------------------

// Coût réel de l'épreuve : null tant qu'aucune dépense ne la concerne (jamais un zéro trompeur), ou sans accès.
export async function coutDeLEpreuve(eventId: string): Promise<number | null> {
  let contexte: ContexteTeam
  try {
    contexte = (await accesBudget("lecture")).ctx
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) return null
    throw erreur
  }
  const agregat = await prismaPourTeam(contexte.teamId, contexte.userId).budgetExpense.aggregate({
    where: { teamId: contexte.teamId, eventId, confirmee: true, deletedAt: null },
    _sum: { montant: true },
    _count: { _all: true },
  })
  if (agregat._count._all === 0) return null
  return agregat._sum.montant ?? 0
}

// Solde affiché dans la barre haute : « Mon solde » au niveau contribution, sinon le solde de la saison en
// cours (recettes encaissées moins dépenses confirmées). Null sans lecture ni saison en cours.
export async function lireSoldeBarreHaute(): Promise<{ libelle: string; montantCentimes: number } | null> {
  let contexte: ContexteTeam
  let niveau: string
  try {
    const acces = await accesBudget("lecture")
    contexte = acces.ctx
    niveau = acces.niveau
  } catch (erreur) {
    if (erreur instanceof ErreurAcces || erreur instanceof ErreurBudget) return null
    throw erreur
  }
  if (niveau === "contribution") {
    const moi = await lireSoldeMoi()
    if (!moi) return null
    return { libelle: "Mon solde", montantCentimes: moi.du - moi.trop }
  }
  const client = prismaPourTeam(contexte.teamId, contexte.userId)
  const aujourdhui = new Date(`${jourDeParis(new Date())}T00:00:00Z`)
  const saison = await client.coreSeason.findFirst({
    where: { teamId: contexte.teamId, deletedAt: null, dateDebut: { lte: aujourdhui }, dateFin: { gte: aujourdhui } },
    select: { id: true },
  })
  if (!saison) return null
  const [recettes, depenses] = await Promise.all([
    client.budgetIncome.aggregate({ where: { teamId: contexte.teamId, seasonId: saison.id, statut: "encaissee", deletedAt: null }, _sum: { montant: true } }),
    client.budgetExpense.aggregate({ where: { teamId: contexte.teamId, seasonId: saison.id, confirmee: true, deletedAt: null }, _sum: { montant: true } }),
  ])
  return { libelle: "Solde de la saison", montantCentimes: (recettes._sum.montant ?? 0) - (depenses._sum.montant ?? 0) }
}

// Onglet « Dépenses » de la fiche épreuve : les mouvements de l'épreuve (la contribution ne voit que les siens),
// le total, le détail par catégorie et, à partir du niveau lecture seulement, le prévu de l'épreuve.
export async function lireDepensesEpreuve(eventId: string): Promise<{
  depenses: Array<{ id: string; date: string; libelle: string; categorieNom: string; montantCentimes: number; payeurNom: string | null }>
  totalCentimes: number
  parCategorie: Array<{ nom: string; montantCentimes: number }>
  prevuCentimes: number | null
}> {
  const { ctx, niveau } = await accesBudget("contribution")
  const { mouvements } = await listerMouvements({ eventId })
  const depenses = mouvements.filter((mouvement) => mouvement.type === "depense" && mouvement.statut === "confirmee")
  const parCategorieMap = new Map<string, { nom: string; montantCentimes: number }>()
  for (const depense of depenses) {
    const existante = parCategorieMap.get(depense.categorieNom) ?? { nom: depense.categorieNom, montantCentimes: 0 }
    existante.montantCentimes += depense.montantCentimes
    parCategorieMap.set(depense.categorieNom, existante)
  }
  const prevu = await prismaPourTeam(ctx.teamId, ctx.userId).budgetForecast.aggregate({
    where: { teamId: ctx.teamId, eventId, deletedAt: null },
    _sum: { montant: true },
    _count: { _all: true },
  })
  return {
    depenses: depenses.map((depense) => ({
      id: depense.id,
      date: depense.date,
      libelle: depense.libelle,
      categorieNom: depense.categorieNom,
      montantCentimes: depense.montantCentimes,
      payeurNom: depense.payeurNom,
    })),
    totalCentimes: depenses.reduce((total, depense) => total + depense.montantCentimes, 0),
    parCategorie: Array.from(parCategorieMap.values()),
    // Chiffre de la team : la contribution ne le reçoit pas, même si elle est au-dessus de la lecture (filtré ici).
    prevuCentimes: voitTout(niveau) && prevu._count._all > 0 ? (prevu._sum.montant ?? 0) : null,
  }
}

// Budget est-il activé pour la team ? (Saison ne reçoit l'onglet et la ligne de coût que dans ce cas.)
export async function budgetActivee(ctx: ContexteTeam): Promise<boolean> {
  const activation = await prismaPourTeam(ctx.teamId, ctx.userId).coreTeamApp.findFirst({
    where: { teamId: ctx.teamId, appCle: "budget", activee: true, deletedAt: null },
    select: { id: true },
  })
  return activation !== null
}

