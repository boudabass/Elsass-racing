// Services serveur de Budget (tâche 2.5, brief section 4). Même structure que Saison : chaque fonction
// publique passe par exigerAcces("budget", niveau) et ne reçoit ni la team ni le compte de l'appelant.
// Les fonctions « …Dans(ctx, …) » font le travail sans garde : elles servent aux vérifications de bus
// et aux scripts, jamais à un composant.
//
// Montants en centimes. Budget n'écrit que ses propres tables : il lit les épreuves, les saisons et les
// personnes de la team, et ne modifie jamais Saison. Aucun écran dans cette tâche (2.6).

import { z } from "zod"

import { jourDeParis } from "@/core/dates"
import type { ContexteTeam } from "@/core/contexte"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { CATEGORIES_DEPENSE, CATEGORIES_RECETTE, CLE_CATEGORIE, NOM_CAISSE_TEAM } from "./categories-defaut"
import { ErreurBudget, refus } from "./erreurs"
import { modifierDepenseTx, supprimerDepenseTx } from "./depenses-tx"
import {
  aRembourser,
  confirmeeDOffice,
  franchissementPrevisionnel,
  resteDu,
  statutRemboursement,
  verifierLigne,
  type TypePayeur,
} from "./regles"

// --- Accès et erreurs -----------------------------------------------------------------------

export async function accesBudget(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("budget", requis)
  const ctx = { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } }
  await initialiserSiBesoin(ctx)
  return { ctx, niveau }
}

// Budget s'initialise à la volée, au premier accès d'une team : catégories et caisse. Sans caisse, rien
// n'a encore été créé : l'initialisation complète (idempotente) est lancée.
export async function initialiserSiBesoin(ctx: ContexteTeam): Promise<void> {
  const caisse = await prismaPourTeam(ctx.teamId, ctx.userId).budgetPayer.findFirst({
    where: { teamId: ctx.teamId, type: "caisse_team", deletedAt: null },
    select: { id: true },
  })
  if (!caisse) await initialiserBudgetDans(ctx)
}

export { ErreurBudget } from "./erreurs"

// Priorité de la demande de confirmation dans la boîte d'actions (1 à 9, 5 : utile, pas urgent).
export const PRIORITE_MOUVEMENT_A_CONFIRMER = 5

// --- Entrées --------------------------------------------------------------------------------

const identifiant = z.string().uuid("Identifiant attendu.")
const montant = z
  .number()
  .int("Montant en centimes entier.")
  .min(0, "Le montant ne peut pas être négatif.")
  .max(100_000_000, "Montant trop élevé : 1 000 000 € au plus par mouvement.")
const dateCivile = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")
  .transform((texte) => new Date(`${texte}T00:00:00Z`))
const moyen = z.enum(["carte", "especes", "cheque", "virement"])

const schemaDepense = z
  .object({
    montant,
    categoryId: identifiant,
    // Facultatif : à défaut, le nom de la catégorie (la saisie en trois champs n'a pas de libellé).
    libelle: z.string().trim().max(200, "Libellé trop long.").optional(),
    payerId: identifiant.optional(),
    date: dateCivile.optional(),
    eventId: identifiant.nullable().optional(),
    moyen: moyen.nullable().optional(),
    fournisseurContactId: identifiant.nullable().optional(),
    vehicleId: identifiant.nullable().optional(),
    entryId: identifiant.nullable().optional(),
  })
  .strict()

export type EntreeDepense = z.input<typeof schemaDepense>

const schemaRecette = z
  .object({
    montant,
    categoryId: identifiant,
    libelle: z.string().trim().min(1, "Libellé attendu.").max(200, "Libellé trop long."),
    date: dateCivile.optional(),
    eventId: identifiant.nullable().optional(),
    provenanceContactId: identifiant.nullable().optional(),
    provenancePersonId: identifiant.nullable().optional(),
    enNature: z.boolean().optional(),
    descriptionNature: z.string().trim().max(300, "Description trop longue.").nullable().optional(),
    valeurEstimee: montant.nullable().optional(),
  })
  .strict()

export type EntreeRecette = z.input<typeof schemaRecette>

const schemaEncaissement = z.object({ recetteId: identifiant, payerId: identifiant, date: dateCivile.optional() }).strict()

const schemaPrevisionnel = z
  .object({
    seasonId: identifiant,
    categoryId: identifiant,
    eventId: identifiant.nullable().optional(),
    montant,
    commentaire: z.string().trim().max(500, "Commentaire trop long.").nullable().optional(),
  })
  .strict()

export type EntreePrevisionnel = z.input<typeof schemaPrevisionnel>

const schemaRemboursement = z
  .object({
    personId: identifiant,
    montant: z.number().int().positive("Le montant remboursé doit être positif."),
    date: dateCivile.optional(),
    moyen,
    payerId: identifiant,
    commentaire: z.string().trim().max(500, "Commentaire trop long.").nullable().optional(),
    lignes: z
      .array(z.object({ expenseId: identifiant, montant: z.number().int().positive("Le montant d'une ligne doit être positif.") }).strict())
      .min(1, "Au moins une dépense à rembourser.")
      .max(200),
  })
  .strict()

export type EntreeRemboursement = z.input<typeof schemaRemboursement>

// Entrée des autres apps (via proposerMouvementDans) : une suggestion que la boîte d'actions fera confirmer.
const schemaSuggestion = z
  .object({
    appOrigine: z.string().trim().min(1).max(40),
    evenementOrigine: z.string().trim().min(1).max(80),
    sens: z.enum(["depense", "recette"]),
    montant,
    categoryId: identifiant,
    libelle: z.string().trim().min(1).max(200),
    eventId: identifiant.nullable().optional(),
    entryId: identifiant.nullable().optional(),
    // Personne désignée par l'événement (par exemple payeurPersonId de saison.engagement_paye) : son payeur
    // membre devient le payeur proposé. À défaut, la caisse de la team à la confirmation.
    payeurPersonId: identifiant.nullable().optional(),
  })
  .strict()

export type EntreeSuggestion = z.input<typeof schemaSuggestion>

// --- Lieux et payeurs -----------------------------------------------------------------------

type Client = ReturnType<typeof prismaPourTeam>

export interface PayeurCourant {
  id: string
  type: TypePayeur
  personId: string | null
}

// Personne rattachée au compte de l'appelant (son membership), ou null.
export async function personneDuMembreDans(ctx: ContexteTeam): Promise<string | null> {
  const membre = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findFirst({
    where: { id: ctx.membership.id, teamId: ctx.teamId },
    select: { personId: true },
  })
  return membre?.personId ?? null
}

// Le payeur « moi » : créé à la volée, de façon idempotente, la première fois qu'il est nécessaire.
export async function payeurDuMembreDans(ctx: ContexteTeam): Promise<PayeurCourant> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const personneId = await personneDuMembreDans(ctx)
  if (!personneId) refus("Ton compte n'est pas rattaché à une personne de la team : impossible de te désigner comme payeur.")
  const personne = await client.corePerson.findFirst({ where: { id: personneId, teamId: ctx.teamId, deletedAt: null }, select: { prenom: true, nom: true } })
  if (!personne) refus("Personne introuvable dans cette team.")
  const payeur = await client.budgetPayer.upsert({
    where: { teamId_personId: { teamId: ctx.teamId, personId: personneId } },
    create: {
      id: newId(),
      teamId: ctx.teamId,
      type: "membre",
      personId: personneId,
      nom: `${personne.prenom} ${personne.nom}`,
      actif: true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    update: {},
  })
  return { id: payeur.id, type: "membre", personId: personneId }
}

// Une saisie de dépense : le payeur est celui qu'on donne, ou soi. Sans écriture, on ne peut payer
// qu'en son nom : un membre de l'assistance ne saisit pas les dépenses d'un autre.
async function payeurPourSaisie(ctx: ContexteTeam, niveau: Niveau, payerId: string | undefined): Promise<PayeurCourant> {
  if (!payerId) return payeurDuMembreDans(ctx)
  const payeur = await prismaPourTeam(ctx.teamId, ctx.userId).budgetPayer.findFirst({
    where: { id: payerId, teamId: ctx.teamId, actif: true, deletedAt: null },
    select: { id: true, type: true, personId: true },
  })
  if (!payeur) refus("Payeur introuvable ou inactif.")
  if (!aAuMoins(niveau, "ecriture")) {
    const moi = await personneDuMembreDans(ctx)
    if (payeur.type !== "membre" || moi === null || payeur.personId !== moi) {
      refus("Tu ne peux saisir que les dépenses que tu as payées toi-même.")
    }
  }
  return { id: payeur.id, type: payeur.type, personId: payeur.personId }
}

// Épreuve et saison d'un engagement de dépense : celle qu'on désigne, ou l'épreuve en cours (seule, aujourd'hui).
async function rattachement(client: Client, teamId: string, eventId: string | null | undefined): Promise<{ eventId: string; seasonId: string } | null> {
  if (eventId) {
    const epreuve = await client.coreEvent.findFirst({ where: { id: eventId, teamId, deletedAt: null }, select: { id: true, seasonId: true } })
    if (!epreuve) refus("Épreuve introuvable dans cette team.")
    return { eventId: epreuve.id, seasonId: epreuve.seasonId }
  }
  const jour = aujourdhui()
  const enCours = await client.coreEvent.findMany({
    where: { teamId, deletedAt: null, dateDebut: { lte: jour }, dateFin: { gte: jour } },
    select: { id: true, seasonId: true },
    take: 2,
  })
  return enCours.length === 1 ? { eventId: enCours[0].id, seasonId: enCours[0].seasonId } : null
}

// Saison dont les dates contiennent ce jour civil : une dépense sans épreuve reste dans sa saison.
export async function saisonPourDate(client: Pick<Client, "coreSeason">, teamId: string, date: Date): Promise<string | null> {
  const saison = await client.coreSeason.findFirst({
    where: { teamId, deletedAt: null, dateDebut: { lte: date }, dateFin: { gte: date } },
    select: { id: true },
  })
  return saison?.id ?? null
}

function aujourdhui(): Date {
  return new Date(`${jourDeParis(new Date())}T00:00:00Z`)
}

// --- Initialisation -------------------------------------------------------------------------

// Catégories par défaut, caisse de la team, et un payeur par membre actif ayant une personne.
// Idempotente : rejouable à volée (catégories et payeurs uniques).
function estConflitUnicite(erreur: unknown): boolean {
  return typeof erreur === "object" && erreur !== null && (erreur as { code?: string }).code === "P2002"
}

export async function initialiserBudgetDans(ctx: ContexteTeam): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const auteur = { createdBy: ctx.userId, updatedBy: ctx.userId }

  await client.budgetCategory.createMany({
    data: [
      ...CATEGORIES_DEPENSE.map((nom, index) => ({ id: newId(), teamId: ctx.teamId, nom, sens: "depense" as const, ordre: index + 1, cle: CLE_CATEGORIE[nom] ?? null, ...auteur })),
      ...CATEGORIES_RECETTE.map((nom, index) => ({ id: newId(), teamId: ctx.teamId, nom, sens: "recette" as const, ordre: index + 1, ...auteur })),
    ],
    skipDuplicates: true,
  })
  // Les teams déjà initialisées avant la clé : on la pose sur la catégorie par défaut.
  for (const [nom, cle] of Object.entries(CLE_CATEGORIE)) {
    await client.budgetCategory.updateMany({ where: { teamId: ctx.teamId, sens: "depense", nom, cle: null }, data: { cle } })
  }

  const caisse = await client.budgetPayer.findFirst({ where: { teamId: ctx.teamId, type: "caisse_team", deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } })
  if (!caisse) {
    // Course avec une autre initialisation (layout et page, en parallèle) : l'index unique refuse le second, la caisse existe déjà.
    await client.budgetPayer.create({ data: { id: newId(), teamId: ctx.teamId, type: "caisse_team", nom: NOM_CAISSE_TEAM, actif: true, ...auteur } }).catch((erreur: unknown) => {
      if (!estConflitUnicite(erreur)) throw erreur
    })
  }

  const membres = await client.coreMembership.findMany({
    where: { teamId: ctx.teamId, statut: "actif", deletedAt: null, personId: { not: null } },
    select: { personId: true },
  })
  const personnes = await client.corePerson.findMany({
    where: { id: { in: membres.map((membre) => membre.personId).filter((id): id is string => id !== null) }, teamId: ctx.teamId, deletedAt: null },
    select: { id: true, prenom: true, nom: true },
  })
  await client.budgetPayer.createMany({
    data: personnes.map((personne) => ({
      id: newId(),
      teamId: ctx.teamId,
      type: "membre" as const,
      personId: personne.id,
      nom: `${personne.prenom} ${personne.nom}`,
      actif: true,
      ...auteur,
    })),
    skipDuplicates: true,
  })
}

// --- Dépenses -------------------------------------------------------------------------------

// Dépense saisie : confirmée d'office. Un membre de l'assistance ne saisit que ce qu'il a payé lui-même.
export async function creerDepense(entree: EntreeDepense): Promise<string> {
  const { ctx, niveau } = await accesBudget("contribution")
  return creerDepenseDans(ctx, entree, niveau)
}

export async function creerDepenseDans(ctx: ContexteTeam, entree: EntreeDepense, niveau: Niveau = "ecriture"): Promise<string> {
  const donnees = schemaDepense.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  const categorie = await client.budgetCategory.findFirst({
    where: { id: donnees.categoryId, teamId: ctx.teamId, sens: "depense", active: true, deletedAt: null },
    select: { id: true, nom: true },
  })
  if (!categorie) refus("Catégorie de dépense introuvable ou inactive.")

  const payeur = await payeurPourSaisie(ctx, niveau, donnees.payerId)
  const lieu = await rattachement(client, ctx.teamId, donnees.eventId)
  const saisonId = lieu?.seasonId ?? (await saisonPourDate(client, ctx.teamId, donnees.date ?? aujourdhui()))
  const id = newId()
  const rembourse = aRembourser(payeur.type)

  await client.budgetExpense.create({
    data: {
      id,
      teamId: ctx.teamId,
      date: donnees.date ?? aujourdhui(),
      montant: donnees.montant,
      categoryId: donnees.categoryId,
      libelle: donnees.libelle || categorie.nom,
      payerId: payeur.id,
      moyen: donnees.moyen ?? null,
      fournisseurContactId: donnees.fournisseurContactId ?? null,
      seasonId: saisonId,
      eventId: lieu?.eventId ?? null,
      entryId: donnees.entryId ?? null,
      vehicleId: donnees.vehicleId ?? null,
      confirmee: confirmeeDOffice("saisie"),
      aRembourser: rembourse,
      remboursement: rembourse ? "a_rembourser" : "non_concerne",
      origine: "saisie",
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  })

  await emettreDepenseCreee(ctx, id)
  return id
}

// Après une dépense confirmée : si la catégorie franchit le prévu de sa saison, un seul événement.
async function verifierDepassement(ctx: ContexteTeam, client: Client, { categoryId, seasonId, ajoute }: { categoryId: string; seasonId: string; ajoute: number }): Promise<void> {
  const prevision = await client.budgetForecast.findFirst({
    where: { teamId: ctx.teamId, seasonId, categoryId, eventId: null, deletedAt: null },
    select: { montant: true },
  })
  if (!prevision) return
  const total = await client.budgetExpense.aggregate({
    where: { teamId: ctx.teamId, seasonId, categoryId, confirmee: true, deletedAt: null },
    _sum: { montant: true },
  })
  const apres = total._sum.montant ?? 0
  if (franchissementPrevisionnel(prevision.montant, apres - ajoute, apres)) {
    await emettre(ctx, "budget.depassement_previsionnel", { categoryId, seasonId, prevu: prevision.montant, reel: apres })
  }
}

// --- Recettes -------------------------------------------------------------------------------

export async function creerRecette(entree: EntreeRecette): Promise<string> {
  const { ctx } = await accesBudget("ecriture")
  return creerRecetteDans(ctx, entree)
}

export async function creerRecetteDans(ctx: ContexteTeam, entree: EntreeRecette): Promise<string> {
  const donnees = schemaRecette.parse(entree)
  if (donnees.enNature && (donnees.valeurEstimee === null || donnees.valeurEstimee === undefined || !donnees.descriptionNature)) {
    refus("Une recette en nature demande sa description et sa valeur estimée.")
  }
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const categorie = await client.budgetCategory.findFirst({
    where: { id: donnees.categoryId, teamId: ctx.teamId, sens: "recette", active: true, deletedAt: null },
    select: { id: true },
  })
  if (!categorie) refus("Catégorie de recette introuvable ou inactive.")
  const lieu = await rattachement(client, ctx.teamId, donnees.eventId)
  const saisonId = lieu?.seasonId ?? (await saisonPourDate(client, ctx.teamId, donnees.date ?? aujourdhui()))
  const id = newId()
  await client.budgetIncome.create({
    data: {
      id,
      teamId: ctx.teamId,
      date: donnees.date ?? aujourdhui(),
      montant: donnees.montant,
      categoryId: donnees.categoryId,
      libelle: donnees.libelle,
      provenanceContactId: donnees.provenanceContactId ?? null,
      provenancePersonId: donnees.provenancePersonId ?? null,
      enNature: donnees.enNature ?? false,
      descriptionNature: donnees.descriptionNature ?? null,
      valeurEstimee: donnees.valeurEstimee ?? null,
      statut: "prevue",
      seasonId: saisonId,
      eventId: lieu?.eventId ?? null,
      origine: "saisie",
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  })
  return id
}

// Encaisser une recette : elle passe « encaissée » sur un compte de la team.
export async function encaisserRecette(entree: z.input<typeof schemaEncaissement>): Promise<void> {
  const { ctx } = await accesBudget("ecriture")
  return encaisserRecetteDans(ctx, entree)
}

export async function encaisserRecetteDans(ctx: ContexteTeam, entree: z.input<typeof schemaEncaissement>): Promise<void> {
  const donnees = schemaEncaissement.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const recette = await client.budgetIncome.findFirst({
    where: { id: donnees.recetteId, teamId: ctx.teamId, deletedAt: null },
    select: { id: true, statut: true, montant: true },
  })
  if (!recette) refus("Recette introuvable dans cette team.")
  if (recette.statut === "encaissee") refus("Cette recette est déjà encaissée.")
  const compte = await client.budgetPayer.findFirst({
    where: { id: donnees.payerId, teamId: ctx.teamId, actif: true, deletedAt: null },
    select: { id: true },
  })
  if (!compte) refus("Compte d'encaissement introuvable ou inactif.")
  await client.budgetIncome.updateMany({
    where: { id: recette.id, teamId: ctx.teamId },
    data: { statut: "encaissee", encaisseeLe: donnees.date ?? aujourdhui(), encaisseeSurPayerId: compte.id, rev: { increment: 1 }, updatedBy: ctx.userId },
  })
  await emettre(ctx, "budget.recette_encaissee", { recetteId: recette.id, montant: recette.montant, payerId: compte.id })
}

// --- Remboursements -------------------------------------------------------------------------

// Un remboursement à un membre, payé depuis la caisse ou un compte d'association. Ses lignes ne dépassent
// jamais le reste dû de chaque dépense ; le total des lignes égale le montant remboursé.
export async function rembourser(entree: EntreeRemboursement): Promise<string> {
  const { ctx } = await accesBudget("gestion")
  return rembourserDans(ctx, entree)
}

export async function rembourserDans(ctx: ContexteTeam, entree: EntreeRemboursement): Promise<string> {
  const donnees = schemaRemboursement.parse(entree)
  const totalLignes = donnees.lignes.reduce((total, ligne) => total + ligne.montant, 0)
  if (totalLignes !== donnees.montant) refus("Le total des lignes doit égaler le montant remboursé.")
  const idsDepenses = donnees.lignes.map((ligne) => ligne.expenseId)
  if (new Set(idsDepenses).size !== idsDepenses.length) refus("Une dépense ne peut figurer qu'une fois dans un remboursement.")

  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const personne = await client.corePerson.findFirst({ where: { id: donnees.personId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!personne) refus("Personne introuvable dans cette team.")
  const compte = await client.budgetPayer.findFirst({
    where: { id: donnees.payerId, teamId: ctx.teamId, actif: true, deletedAt: null },
    select: { id: true, type: true },
  })
  if (!compte) refus("Compte de remboursement introuvable ou inactif.")
  if (compte.type === "membre") refus("Un remboursement se fait depuis la caisse ou un compte de l'association.")

  const depenses = await client.budgetExpense.findMany({
    where: { id: { in: idsDepenses }, teamId: ctx.teamId, deletedAt: null },
    include: { payer: { select: { personId: true } }, lignes: { where: { deletedAt: null }, select: { montant: true } } },
  })
  if (depenses.length !== idsDepenses.length) refus("Une dépense citée est introuvable dans cette team.")

  for (const ligne of donnees.lignes) {
    const depense = depenses.find((candidate) => candidate.id === ligne.expenseId)
    if (!depense) refus("Une dépense citée est introuvable dans cette team.")
    if (!depense.confirmee || !depense.aRembourser) refus(`La dépense « ${depense.libelle} » n'est pas à rembourser.`)
    if (depense.payer.personId !== donnees.personId) refus(`La dépense « ${depense.libelle} » n'a pas été payée par cette personne.`)
    const message = verifierLigne(
      resteDu(depense.montant, depense.lignes.map((existante) => existante.montant)),
      ligne.montant,
    )
    if (message) refus(message)
  }

  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.budgetReimbursement.create({
      data: {
        id,
        teamId: ctx.teamId,
        personId: donnees.personId,
        montant: donnees.montant,
        date: donnees.date ?? aujourdhui(),
        moyen: donnees.moyen,
        payerId: compte.id,
        commentaire: donnees.commentaire ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    for (const ligne of donnees.lignes) {
      await tx.budgetReimbursementLine.create({
        data: { id: newId(), teamId: ctx.teamId, reimbursementId: id, expenseId: ligne.expenseId, montant: ligne.montant, createdBy: ctx.userId, updatedBy: ctx.userId },
      })
    }
    for (const depense of depenses) {
      const lignes = [
        ...depense.lignes.map((existante) => existante.montant),
        ...donnees.lignes.filter((ligne) => ligne.expenseId === depense.id).map((ligne) => ligne.montant),
      ]
      await tx.budgetExpense.updateMany({
        where: { id: depense.id, teamId: ctx.teamId },
        data: {
          remboursement: statutRemboursement({ montant: depense.montant, aRembourser: depense.aRembourser }, lignes),
          rev: { increment: 1 },
          updatedBy: ctx.userId,
        },
      })
    }
  })

  await emettre(ctx, "budget.remboursement_effectue", { remboursementId: id, personId: donnees.personId, montant: donnees.montant })
  await emettre(ctx, "budget.solde_modifie", { personId: donnees.personId, remboursementId: id })
  return id
}

// --- Prévisionnel ---------------------------------------------------------------------------

// Un prévisionnel par catégorie et par saison (sans épreuve), ou par épreuve : créé ou mis à jour.
export async function definirPrevisionnel(entree: EntreePrevisionnel): Promise<void> {
  const { ctx } = await accesBudget("gestion")
  return definirPrevisionnelDans(ctx, entree)
}

export async function definirPrevisionnelDans(ctx: ContexteTeam, entree: EntreePrevisionnel): Promise<void> {
  const donnees = schemaPrevisionnel.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const saison = await client.coreSeason.findFirst({ where: { id: donnees.seasonId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!saison) refus("Saison introuvable dans cette team.")
  const categorie = await client.budgetCategory.findFirst({
    where: { id: donnees.categoryId, teamId: ctx.teamId, active: true, deletedAt: null },
    select: { id: true },
  })
  if (!categorie) refus("Catégorie introuvable ou inactive.")
  const eventId = donnees.eventId ?? null
  if (eventId) await rattachement(client, ctx.teamId, eventId)

  const existant = await client.budgetForecast.findFirst({
    where: { teamId: ctx.teamId, seasonId: donnees.seasonId, categoryId: donnees.categoryId, eventId, deletedAt: null },
    select: { id: true },
  })
  if (existant) {
    await client.budgetForecast.updateMany({
      where: { id: existant.id, teamId: ctx.teamId },
      data: { montant: donnees.montant, commentaire: donnees.commentaire ?? null, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  } else {
    await client.budgetForecast.create({
      data: {
        id: newId(),
        teamId: ctx.teamId,
        seasonId: donnees.seasonId,
        categoryId: donnees.categoryId,
        eventId,
        montant: donnees.montant,
        commentaire: donnees.commentaire ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  }
}

// --- Suggestions (mouvements proposés par d'autres apps) -----------------------------------

// Le payeur membre d'une personne de la team, créé à la volée (idempotent) : il sert aux mouvements proposés.
export async function payeurDePersonneDans(ctx: ContexteTeam, personneId: string): Promise<string> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const personne = await client.corePerson.findFirst({ where: { id: personneId, teamId: ctx.teamId, deletedAt: null }, select: { prenom: true, nom: true } })
  if (!personne) refus("Personne introuvable dans cette team.")
  const payeur = await client.budgetPayer.upsert({
    where: { teamId_personId: { teamId: ctx.teamId, personId: personneId } },
    create: { id: newId(), teamId: ctx.teamId, type: "membre", personId: personneId, nom: `${personne.prenom} ${personne.nom}`, actif: true, createdBy: ctx.userId, updatedBy: ctx.userId },
    update: {},
  })
  return payeur.id
}

// Usage interne des gestionnaires d'événements : crée la suggestion et demande sa confirmation.
export async function proposerMouvementDans(ctx: ContexteTeam, entree: EntreeSuggestion): Promise<string> {
  const donnees = schemaSuggestion.parse(entree)
  // Une autre app peut proposer un mouvement avant que Budget n'ait été ouvert : on l'initialise d'abord.
  await initialiserSiBesoin(ctx)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const categorie = await client.budgetCategory.findFirst({
    where: { id: donnees.categoryId, teamId: ctx.teamId, sens: donnees.sens, active: true, deletedAt: null },
    select: { id: true },
  })
  if (!categorie) refus("Catégorie introuvable pour ce sens, ou inactive.")
  const lieu = await rattachement(client, ctx.teamId, donnees.eventId)
  const id = newId()
  const actionCle = `budget_suggestion:${id}`

  const payeurId = donnees.payeurPersonId ? await payeurDePersonneDans(ctx, donnees.payeurPersonId) : null
  await client.budgetSuggestion.create({
    data: {
      id,
      teamId: ctx.teamId,
      appOrigine: donnees.appOrigine,
      evenementOrigine: donnees.evenementOrigine,
      sens: donnees.sens,
      montant: donnees.montant,
      categoryId: donnees.categoryId,
      libelle: donnees.libelle,
      eventId: lieu?.eventId ?? null,
      entryId: donnees.entryId ?? null,
      statut: "en_attente",
      payerId: payeurId,
      actionCle,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  })

  await emettre(ctx, "budget.action_requise", {
    type: "mouvement_a_confirmer",
    cleUnicite: actionCle,
    titre: `Confirmer le mouvement : ${donnees.libelle}`,
    contexte: `${donnees.appOrigine} · ${donnees.evenementOrigine}`,
    ficheType: "mouvement",
    ficheId: id,
    ...(lieu ? { eventId: lieu.eventId } : {}),
    destinataires: { roles: ["responsable", "equipage"] },
    boutons: [
      { cle: "confirmer", libelle: "Confirmer" },
      { cle: "ignorer", libelle: "Ignorer" },
    ],
    priorite: PRIORITE_MOUVEMENT_A_CONFIRMER,
    niveauRequis: "ecriture",
    cleRegroupement: "mouvements_a_confirmer",
  })
  return id
}

// Confirmer une suggestion : un humain la valide, elle devient une dépense (ou une recette prévue).
// Surcharges au moment de confirmer : l'humain peut changer le payeur et la catégorie proposés.
export interface ModifsSuggestion {
  payerId?: string
  categoryId?: string
}

export async function confirmerSuggestion(id: string, modifs: ModifsSuggestion = {}): Promise<string> {
  const { ctx } = await accesBudget("ecriture")
  return confirmerSuggestionDans(ctx, id, modifs)
}

export async function confirmerSuggestionDans(ctx: ContexteTeam, id: string, modifs: ModifsSuggestion = {}): Promise<string> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const suggestion = await client.budgetSuggestion.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!suggestion) refus("Suggestion introuvable dans cette team.")
  if (suggestion.statut !== "en_attente") refus("Cette suggestion n'est plus en attente.")
  const categorieId = modifs.categoryId ?? suggestion.categoryId
  if (modifs.categoryId) {
    const categorie = await client.budgetCategory.findFirst({ where: { id: categorieId, teamId: ctx.teamId, sens: suggestion.sens, active: true, deletedAt: null }, select: { id: true } })
    if (!categorie) refus("Catégorie introuvable, inactive, ou d'un autre sens que le mouvement.")
  }

  const mouvementId = newId()
  // Une proposition venant de Saison garde l'engagement comme référence : saison:<entryId> (aucune boucle).
  const origineRef = suggestion.appOrigine === "saison" && suggestion.entryId ? `saison:${suggestion.entryId}` : `${suggestion.appOrigine}:${suggestion.id}`
  const lieu = await rattachement(client, ctx.teamId, suggestion.eventId)
  const saisonId = lieu?.seasonId ?? (await saisonPourDate(client, ctx.teamId, aujourdhui()))

  if (suggestion.sens === "depense") {
    const caisse = await client.budgetPayer.findFirst({ where: { teamId: ctx.teamId, type: "caisse_team", actif: true, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } })
    const payeurId = modifs.payerId ?? suggestion.payerId ?? caisse?.id
    if (!payeurId) refus("Aucune caisse de la team : initialise Budget avant de confirmer une dépense.")
    await client.budgetExpense.create({
      data: {
        id: mouvementId,
        teamId: ctx.teamId,
        date: aujourdhui(),
        montant: suggestion.montant,
        categoryId: categorieId,
        libelle: suggestion.libelle,
        payerId: payeurId,
        seasonId: saisonId,
        eventId: lieu?.eventId ?? null,
        entryId: suggestion.entryId,
        confirmee: true,
        aRembourser: false,
        remboursement: "non_concerne",
        origine: "proposee",
        origineRef,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await emettreDepenseCreee(ctx, mouvementId)
  } else {
    await client.budgetIncome.create({
      data: {
        id: mouvementId,
        teamId: ctx.teamId,
        date: aujourdhui(),
        montant: suggestion.montant,
        categoryId: categorieId,
        libelle: suggestion.libelle,
        statut: "prevue",
        seasonId: saisonId,
        eventId: lieu?.eventId ?? null,
        origine: "proposee",
        origineRef,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  }

  await client.budgetSuggestion.updateMany({
    where: { id, teamId: ctx.teamId },
    data: { statut: "confirmee", mouvementId, rev: { increment: 1 }, updatedBy: ctx.userId },
  })
  return mouvementId
}

export async function ignorerSuggestion(id: string): Promise<void> {
  const { ctx } = await accesBudget("ecriture")
  return ignorerSuggestionDans(ctx, id)
}

export async function ignorerSuggestionDans(ctx: ContexteTeam, id: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const suggestion = await client.budgetSuggestion.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { statut: true } })
  if (!suggestion) refus("Suggestion introuvable dans cette team.")
  if (suggestion.statut !== "en_attente") refus("Cette suggestion n'est plus en attente.")
  await client.budgetSuggestion.updateMany({
    where: { id, teamId: ctx.teamId },
    data: { statut: "ignoree", rev: { increment: 1 }, updatedBy: ctx.userId },
  })
}

// Décision de la boîte d'actions : même règle que les fonctions publiques. Un refus métier remet l'action
// en attente, avec son motif (même règle que Saison).
async function appliquerDecisionBudget(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const donnees = evenement.donnees as { type?: string; decision?: string; cleUnicite?: string; ficheId?: string }
  if (donnees.type !== "mouvement_a_confirmer" || !donnees.ficheId) return
  try {
    if (donnees.decision === "confirmer") await confirmerSuggestionDans(ctx, donnees.ficheId)
    if (donnees.decision === "ignorer") await ignorerSuggestionDans(ctx, donnees.ficheId)
  } catch (erreur) {
    if (!(erreur instanceof ErreurBudget)) throw erreur
    await rouvrirAction(prismaPourTeam(ctx.teamId, ctx.userId), ctx, donnees.cleUnicite, erreur.message)
  }
}

// Même règle que rouvrirAction de Saison (services-serveur.ts).
async function rouvrirAction(client: Client, ctx: ContexteTeam, cleUnicite: string | undefined, motif: string): Promise<void> {
  if (!cleUnicite) return
  await client.coreAction.updateMany({
    where: { teamId: ctx.teamId, cleUnicite },
    data: { statut: "en_attente", decision: null, decideeParMembershipId: null, decideeAt: null, messageRefus: motif, updatedBy: ctx.userId },
  })
}

// Événements d'une dépense créée (en ligne, par une suggestion confirmée, ou par la synchro). Une seule
// source : la ligne lue, pour que les liaisons (engagement, origine) reçoivent les mêmes champs partout.
export async function emettreDepenseCreee(ctx: ContexteTeam, id: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const depense = await client.budgetExpense.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    select: {
      montant: true,
      date: true,
      categoryId: true,
      payerId: true,
      eventId: true,
      seasonId: true,
      entryId: true,
      origineRef: true,
      category: { select: { cle: true } },
      payer: { select: { type: true, personId: true } },
    },
  })
  if (!depense) return
  await emettre(ctx, "budget.depense_creee", {
    depenseId: id,
    montant: depense.montant,
    date: depense.date.toISOString().slice(0, 10),
    categoryId: depense.categoryId,
    categorieCle: depense.category.cle,
    payerId: depense.payerId,
    personneId: depense.payer.personId,
    eventId: depense.eventId,
    seasonId: depense.seasonId,
    entryId: depense.entryId,
    origineRef: depense.origineRef,
  })
  await emettre(ctx, "budget.depense_confirmee", { depenseId: id, eventId: depense.eventId })
  if (depense.payer.type === "membre" && depense.payer.personId) {
    await emettre(ctx, "budget.solde_modifie", { personId: depense.payer.personId, depenseId: id })
  }
  if (depense.seasonId) {
    await verifierDepassement(ctx, client, { categoryId: depense.categoryId, seasonId: depense.seasonId, ajoute: depense.montant })
  }
}

// Synchro : l'événement de la création, émis une fois la écriture validée.
export async function emettreDepenseSynchronisee(ctx: ContexteTeam, id: string): Promise<void> {
  return emettreDepenseCreee(ctx, id)
}

// Enregistré à l'import du module : l'app Budget reçoit les décisions de la boîte d'actions.
enregistrerGestionnaire("budget", "core.action_decidee", appliquerDecisionBudget)

// --- Tâche 2.7 : modifier et supprimer (section 0) ---------------------------------------------

// Modifie une dépense (même règle qu'en synchro : depenses-tx.ts). Les soldes concernés sont prévenus.
export async function modifierDepense(id: string, entree: EntreeDepense): Promise<void> {
  const { ctx, niveau } = await accesBudget("contribution")
  return modifierDepenseDans(ctx, id, entree, niveau)
}

export async function modifierDepenseDans(ctx: ContexteTeam, id: string, entree: EntreeDepense, niveau: Niveau = "ecriture"): Promise<void> {
  const donnees = schemaDepense.parse(entree)
  if (!donnees.payerId) refus("Indique qui a payé la dépense.")
  const lieu = await rattachement(prismaPourTeam(ctx.teamId, ctx.userId), ctx.teamId, donnees.eventId)
  const date = donnees.date ?? aujourdhui()
  const saisonId = lieu?.seasonId ?? (await saisonPourDate(prismaPourTeam(ctx.teamId, ctx.userId), ctx.teamId, date))
  const personnes = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const categorie = await tx.budgetCategory.findFirst({ where: { id: donnees.categoryId, teamId: ctx.teamId, sens: "depense", active: true, deletedAt: null }, select: { nom: true } })
    if (!categorie) refus("Catégorie de dépense introuvable ou inactive.")
    return modifierDepenseTx(
      tx,
      ctx,
      id,
      {
        montant: donnees.montant,
        categoryId: donnees.categoryId,
        libelle: donnees.libelle || categorie.nom,
        payerId: donnees.payerId as string,
        date,
        eventId: lieu?.eventId ?? null,
        entryId: donnees.entryId ?? null,
        seasonId: saisonId,
        moyen: donnees.moyen ?? null,
      },
      niveau,
    )
  })
  for (const personneId of personnes.personnes) {
    await emettre(ctx, "budget.solde_modifie", { personId: personneId, depenseId: id })
  }
}

// Supprime une dépense (suppression douce). Une dépense remboursée ne se supprime pas.
export async function supprimerDepense(id: string): Promise<void> {
  const { ctx, niveau } = await accesBudget("contribution")
  return supprimerDepenseDans(ctx, id, niveau)
}

export async function supprimerDepenseDans(ctx: ContexteTeam, id: string, niveau: Niveau = "ecriture"): Promise<void> {
  const { personnes } = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => supprimerDepenseTx(tx, ctx, id, niveau))
  for (const personneId of personnes) {
    await emettre(ctx, "budget.solde_modifie", { personId: personneId, depenseId: id })
  }
}

// Solde d'une dépense modifiée ou supprimée depuis l'appareil : prévient le payeur membre.
export async function emettreSoldeDepenseSynchronise(ctx: ContexteTeam, id: string): Promise<void> {
  const depense = await prismaPourTeam(ctx.teamId, ctx.userId).budgetExpense.findFirst({
    where: { id, teamId: ctx.teamId },
    select: { payer: { select: { type: true, personId: true } } },
  })
  if (depense?.payer.type === "membre" && depense.payer.personId) {
    await emettre(ctx, "budget.solde_modifie", { personId: depense.payer.personId, depenseId: id })
  }
}

// Recettes : modifier (écriture) et supprimer (suppression douce). Le statut « encaissée » ne change pas ici.
export async function modifierRecette(id: string, entree: EntreeRecette): Promise<void> {
  const { ctx } = await accesBudget("ecriture")
  return modifierRecetteDans(ctx, id, entree)
}

export async function modifierRecetteDans(ctx: ContexteTeam, id: string, entree: EntreeRecette): Promise<void> {
  const donnees = schemaRecette.parse(entree)
  if (donnees.enNature && (donnees.valeurEstimee === null || donnees.valeurEstimee === undefined || !donnees.descriptionNature)) {
    refus("Une recette en nature demande sa description et sa valeur estimée.")
  }
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existante = await client.budgetIncome.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!existante) refus("Recette introuvable dans cette team.")
  const categorie = await client.budgetCategory.findFirst({
    where: { id: donnees.categoryId, teamId: ctx.teamId, sens: "recette", active: true, deletedAt: null },
    select: { id: true },
  })
  if (!categorie) refus("Catégorie de recette introuvable ou inactive.")
  const lieu = await rattachement(client, ctx.teamId, donnees.eventId)
  const saisonId = lieu?.seasonId ?? (await saisonPourDate(client, ctx.teamId, donnees.date ?? aujourdhui()))
  await client.budgetIncome.updateMany({
    where: { id, teamId: ctx.teamId },
    data: {
      date: donnees.date ?? aujourdhui(),
      montant: donnees.montant,
      categoryId: donnees.categoryId,
      libelle: donnees.libelle,
      provenancePersonId: donnees.provenancePersonId ?? null,
      enNature: donnees.enNature ?? false,
      descriptionNature: donnees.descriptionNature ?? null,
      valeurEstimee: donnees.valeurEstimee ?? null,
      eventId: lieu?.eventId ?? null,
      seasonId: saisonId,
      rev: { increment: 1 },
      updatedBy: ctx.userId,
    },
  })
}

export async function supprimerRecette(id: string): Promise<void> {
  const { ctx } = await accesBudget("ecriture")
  return supprimerRecetteDans(ctx, id)
}

export async function supprimerRecetteDans(ctx: ContexteTeam, id: string): Promise<void> {
  const resultat = await prismaPourTeam(ctx.teamId, ctx.userId).budgetIncome.updateMany({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
  })
  if (resultat.count === 0) refus("Recette introuvable dans cette team.")
}
