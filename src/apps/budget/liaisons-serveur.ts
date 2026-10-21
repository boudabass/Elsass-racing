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
import type { Tx } from "@/core/synchro/registre"

import { ErreurBudget, refus } from "./erreurs"
import { categorieParCle, modePaiementSaison, voitTout } from "./regles"
import { phraseSoldeMoi } from "./libelles"
import { lireSoldeMoi, listerMouvements } from "./lectures-serveur"
import { accesBudget, initialiserSiBesoin, payeurDePersonneDans, PRIORITE_MOUVEMENT_A_CONFIRMER, proposerMouvementDans } from "./services-serveur"

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

// --- Partenaires signe une convention : les recettes prévues (brief 3.8, §2.1) ----------------------

const schemaConventionSignee = z.object({
  agreementId: z.string().min(1),
  partenaireNom: z.string().min(1),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  apportFinancierCentimes: z.number().int().min(0),
  echeancier: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), montantCentimes: z.number().int().min(0) })),
})

// Une recette prévue par versement de l'échéancier ; sans échéancier, une seule, à la date de début, pour l'apport
// financier. Chaque versement a sa référence partenaires:<agreementId>:<rang> : une convention signée deux fois, ou un
// événement rejoué, ne propose rien de plus (proposerMouvementDans rend la proposition existante).
export async function proposerRecettesConventionDans(ctx: ContexteTeam, entree: z.input<typeof schemaConventionSignee>): Promise<void> {
  const donnees = schemaConventionSignee.parse(entree)
  const liste = donnees.echeancier.length > 0 ? donnees.echeancier.map((v) => ({ date: v.date, montant: v.montantCentimes })) : [{ date: donnees.dateDebut, montant: donnees.apportFinancierCentimes }]
  const versements = liste.map((v, index) => ({ ...v, rang: index + 1 })).filter((v) => v.montant > 0)
  if (versements.length === 0) return
  // Budget ouvert avant la proposition : la catégorie « Partenaire » vient de l'initialisation.
  await initialiserSiBesoin(ctx)
  const categorie = await prismaPourTeam(ctx.teamId, ctx.userId).budgetCategory.findFirst({
    where: { teamId: ctx.teamId, sens: "recette", nom: "Partenaire", active: true, deletedAt: null },
    select: { id: true },
  })
  if (!categorie) return

  for (const versement of versements) {
    await proposerMouvementDans(ctx, {
      appOrigine: "partenaires",
      evenementOrigine: "partenaires.convention_signee",
      sens: "recette",
      montant: versement.montant,
      categoryId: categorie.id,
      libelle: `${donnees.partenaireNom}, versement ${versement.rang} sur ${liste.length}`,
      date: versement.date,
      origineRef: `partenaires:${donnees.agreementId}:${versement.rang}`,
    })
  }
}

enregistrerGestionnaire("budget", "partenaires.convention_signee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = schemaConventionSignee.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerRecettesConventionDans(ctx, analyse.data)
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
export async function lireSoldeBarreHaute(): Promise<{ libelle: string; montantCentimes: number; texte?: string } | null> {
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
    const montantCentimes = moi.du - moi.trop
    return { libelle: "Mon solde", montantCentimes, texte: phraseSoldeMoi(montantCentimes) }
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


// --- Lecture pour Partenaires : l'état des recettes d'une convention (brief 3.8, §7) ------------------

// Total prévu et encaissé des recettes dont la référence commence par le préfixe (partenaires:<agreementId>:). Lecture
// seule : Partenaires n'ouvre pas les tables de Budget, il appelle cette fonction.
export async function etatRecettesParOrigine(
  tx: Pick<Tx, "budgetIncome">,
  teamId: string,
  prefixe: string,
): Promise<{ totalCentimes: number; encaisseCentimes: number }> {
  const groupes = await tx.budgetIncome.groupBy({
    by: ["statut"],
    where: { teamId, origineRef: { startsWith: prefixe }, deletedAt: null },
    _sum: { montant: true },
  })
  let totalCentimes = 0
  let encaisseCentimes = 0
  for (const groupe of groupes) {
    const montant = groupe._sum.montant ?? 0
    totalCentimes += montant
    if (groupe.statut === "encaissee") encaisseCentimes += montant
  }
  return { totalCentimes, encaisseCentimes }
}

// Recettes d'une origine (préfixe, p. ex. partenaires:<convention>:) pour l'écran de la convention (brief 3.11, §4).
// Lecture seule, par le contexte de Partenaires : Partenaires n'ouvre pas la table budgetIncome.
export async function lireRecettesParOrigineDans(ctx: ContexteTeam, prefixe: string) {
  return prismaPourTeam(ctx.teamId, ctx.userId).budgetIncome.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, origineRef: { startsWith: prefixe } },
    select: { id: true, montant: true, date: true, statut: true, encaisseeLe: true, origineRef: true },
    orderBy: { date: "asc" },
  })
}

// --- Garage : pièces achetées et main-d'œuvre facturée (tâche 4.3, brief §2, D8) -----------------
// Budget propose la dépense ; il ne lit pas les tables du Garage et ne lit que la charge de l'événement. La catégorie se
// trouve par sa clé stable (pieces, main_oeuvre), jamais par son nom. Si la clé manque, Budget n'écrit rien dans
// budget_category : la proposition n'est pas créée, et le journal donne l'identifiant et le montant pour la retrouver.

const schemaPieceAchetee = z.object({
  purchaseId: z.string().min(1),
  totalCents: z.number().int().min(1),
  recueLe: z.string().min(1),
})

const schemaInterventionFacturee = z.object({
  workOrderId: z.string().min(1),
  coutCents: z.number().int().min(1),
})

async function categorieGarageDans(ctx: ContexteTeam, cle: string): Promise<string | null> {
  const categories = await prismaPourTeam(ctx.teamId, ctx.userId).budgetCategory.findMany({
    where: { teamId: ctx.teamId, sens: "depense", active: true, deletedAt: null, cle: { not: null } },
    select: { id: true, cle: true },
  })
  return categorieParCle(categories, cle)
}

function journaliserCategorieAbsente(cle: string, origineRef: string, montantCents: number): void {
  console.error(`[budget] catégorie « ${cle} » introuvable : proposition garage non créée (${origineRef}, ${montantCents} centimes).`)
}

export async function proposerDepensePieceDans(ctx: ContexteTeam, entree: z.input<typeof schemaPieceAchetee>): Promise<void> {
  const donnees = schemaPieceAchetee.parse(entree)
  const origineRef = `garage_purchase:${donnees.purchaseId}`
  await initialiserSiBesoin(ctx)
  const categorieId = await categorieGarageDans(ctx, "pieces")
  if (!categorieId) return journaliserCategorieAbsente("pieces", origineRef, donnees.totalCents)
  await proposerMouvementDans(ctx, {
    appOrigine: "garage",
    evenementOrigine: "garage.piece_achetee",
    sens: "depense",
    montant: donnees.totalCents,
    categoryId: categorieId,
    libelle: "Pièces achetées (Garage)",
    date: jourDeParis(new Date(donnees.recueLe)),
    origineRef,
  })
}

export async function proposerDepenseMainOeuvreDans(ctx: ContexteTeam, entree: z.input<typeof schemaInterventionFacturee>): Promise<void> {
  const donnees = schemaInterventionFacturee.parse(entree)
  const origineRef = `garage_work_order:${donnees.workOrderId}`
  await initialiserSiBesoin(ctx)
  const categorieId = await categorieGarageDans(ctx, "main_oeuvre")
  if (!categorieId) return journaliserCategorieAbsente("main_oeuvre", origineRef, donnees.coutCents)
  await proposerMouvementDans(ctx, {
    appOrigine: "garage",
    evenementOrigine: "garage.intervention_facturee",
    sens: "depense",
    montant: donnees.coutCents,
    categoryId: categorieId,
    libelle: "Main-d'œuvre (Garage)",
    date: jourDeParis(new Date()),
    origineRef,
  })
}

// Une commande reçue et une intervention facturée : une proposition par référence, donc un événement rejoué ne crée rien.
enregistrerGestionnaire("budget", "garage.piece_achetee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = schemaPieceAchetee.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerDepensePieceDans(ctx, analyse.data)
})

enregistrerGestionnaire("budget", "garage.intervention_facturee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = schemaInterventionFacturee.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerDepenseMainOeuvreDans(ctx, analyse.data)
})
