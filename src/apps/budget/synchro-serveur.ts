// Déclarations de synchro de Budget (brief 2.6, section 2 ; docs/app-sdk.md, section 9).
// budget_expense : contribution propre, saisie hors ligne au bord de la spéciale, envoyée au retour du réseau.
// Les catégories et les payeurs se lisent hors ligne (lecture seule). Les recettes et le prévisionnel ne se
// synchronisent pas : ils s'écrivent en ligne.
//
// Les règles de la saisie sont celles de creerDepenseDans : payeur et catégorie valides, et, sans écriture,
// seulement ses propres paiements. Les événements sont émis une fois l'écriture validée (apresApplication).

import { z } from "zod"

import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import { RefusSynchro } from "@/core/synchro/erreurs"
import { apresPosition } from "@/core/synchro/position"
import type { ClientTeam, DeclarationSynchro, EtatLigneSynchro, Tx } from "@/core/synchro/registre"
import { prismaPourTeam } from "@/lib/prisma"

import { aRembourser, confirmeeDOffice } from "./regles"
import { emettreDepenseSynchronisee, emettreSoldeDepenseSynchronise } from "./services-serveur"
import { modifierDepenseTx, supprimerDepenseTx } from "./depenses-tx"

const DATE_CIVILE = /^\d{4}-\d{2}-\d{2}$/

interface Socle {
  id: string
  rev: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  createdBy: string | null
  updatedBy: string | null
}

function socle(ligne: Socle) {
  return {
    id: ligne.id,
    rev: ligne.rev,
    createdAt: ligne.createdAt.toISOString(),
    updatedAt: ligne.updatedAt.toISOString(),
    deletedAt: ligne.deletedAt?.toISOString() ?? null,
    createdBy: ligne.createdBy,
    updatedBy: ligne.updatedBy,
  }
}

// Saison de la dépense : celle de l'épreuve, sinon celle dont les dates contiennent le jour.
async function saisonDeLaDepense(tx: Tx, ctx: ContexteTeam, eventId: string | null, date: string): Promise<string | null> {
  if (eventId) {
    const epreuve = await tx.coreEvent.findFirst({ where: { id: eventId, teamId: ctx.teamId, deletedAt: null }, select: { seasonId: true } })
    if (!epreuve) throw new RefusSynchro("Épreuve introuvable dans cette team.")
    return epreuve.seasonId
  }
  const jour = new Date(`${date}T00:00:00Z`)
  const saison = await tx.coreSeason.findFirst({ where: { teamId: ctx.teamId, deletedAt: null, dateDebut: { lte: jour }, dateFin: { gte: jour } }, select: { id: true } })
  return saison?.id ?? null
}

function refusLectureSeule(): never {
  throw new RefusSynchro("Cette donnée se lit seulement hors ligne : elle ne s'écrit pas depuis l'appareil.")
}

const schemaDepense = z
  .object({
    date: z.string().regex(DATE_CIVILE, "Date de la dépense attendue."),
    montant: z.number().int().min(0, "Le montant ne peut pas être négatif.").max(100_000_000, "Montant trop élevé : 1 000 000 € au plus par mouvement."),
    categoryId: z.string().uuid(),
    libelle: z.string().trim().max(200, "Libellé trop long.").nullable().optional(),
    payerId: z.string().uuid(),
    eventId: z.string().uuid().nullable().optional(),
    entryId: z.string().uuid().nullable().optional(),
    moyen: z.enum(["carte", "especes", "cheque", "virement"]).nullable().optional(),
  })
  .strict()

// Une dépense saisie hors ligne ne se modifie ni ne se supprime depuis l'appareil : c'est une saisie.
const budgetExpenseSynchro: DeclarationSynchro = {
  cle: "budget_expense",
  ficheType: "depense",
  app: "budget",
  niveauLecture: "contribution",
  contributionPropre: true,
  lectureSeule: false,
  schemaChamps: schemaDepense,

  // Niveau contribution : ses dépenses, celles dont il est le payeur (règle de la lecture en ligne, voitTout).
  async lirePaquet(client: ClientTeam, teamId, position, limite, auteurId) {
    let perimetre = {}
    if (auteurId) {
      const membre = await client.coreMembership.findFirst({ where: { teamId, userId: auteurId, deletedAt: null }, select: { personId: true } })
      if (!membre?.personId) return []
      perimetre = { payer: { personId: membre.personId } }
    }
    const lignes = await client.budgetExpense.findMany({
      where: { teamId, ...perimetre, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socle(l),
      date: l.date.toISOString().slice(0, 10),
      montant: l.montant,
      categoryId: l.categoryId,
      libelle: l.libelle,
      payerId: l.payerId,
      eventId: l.eventId,
      moyen: l.moyen,
      confirmee: l.confirmee,
      aRembourser: l.aRembourser,
      remboursement: l.remboursement,
      origine: l.origine,
    }))
  },
  async trouver(tx: Tx, teamId, id): Promise<EtatLigneSynchro | null> {
    const ligne = await tx.budgetExpense.findFirst({ where: { id, teamId } })
    if (!ligne) return null
    // Qui peut écrire la ligne au niveau contribution : celui dont la personne est le payeur (comme en lecture).
    const payeur = await tx.budgetPayer.findFirst({ where: { id: ligne.payerId, teamId }, select: { personId: true } })
    let auteurId = ligne.createdBy
    if (payeur?.personId) {
      const membre = await tx.coreMembership.findFirst({ where: { teamId, personId: payeur.personId, deletedAt: null }, select: { userId: true } })
      auteurId = membre?.userId ?? null
    }
    return {
      rev: ligne.rev,
      auteurId,
      supprimee: ligne.deletedAt !== null,
      contenu: { date: ligne.date.toISOString().slice(0, 10), montant: ligne.montant, categoryId: ligne.categoryId, libelle: ligne.libelle, payerId: ligne.payerId, eventId: ligne.eventId, moyen: ligne.moyen },
    }
  },
  async creer(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = schemaDepense.parse(champs)
    const niveau = await niveauDe(ctx, "budget")

    const payeur = await tx.budgetPayer.findFirst({
      where: { id: donnees.payerId, teamId: ctx.teamId, actif: true, deletedAt: null },
      select: { type: true, personId: true },
    })
    if (!payeur) throw new RefusSynchro("Payeur introuvable ou inactif.")
    if (!aAuMoins(niveau, "ecriture")) {
      const membre = await tx.coreMembership.findFirst({ where: { id: ctx.membership.id, teamId: ctx.teamId }, select: { personId: true } })
      if (payeur.type !== "membre" || !membre?.personId || payeur.personId !== membre.personId) {
        throw new RefusSynchro("Tu ne peux saisir que les dépenses que tu as payées toi-même.")
      }
    }

    const categorie = await tx.budgetCategory.findFirst({
      where: { id: donnees.categoryId, teamId: ctx.teamId, sens: "depense", active: true, deletedAt: null },
      select: { nom: true },
    })
    if (!categorie) throw new RefusSynchro("Catégorie de dépense introuvable ou inactive.")

    let seasonId: string | null = null
    if (donnees.eventId) {
      const epreuve = await tx.coreEvent.findFirst({ where: { id: donnees.eventId, teamId: ctx.teamId, deletedAt: null }, select: { seasonId: true } })
      if (!epreuve) throw new RefusSynchro("Épreuve introuvable dans cette team.")
      seasonId = epreuve.seasonId
    } else {
      const jour = new Date(`${donnees.date}T00:00:00Z`)
      const saison = await tx.coreSeason.findFirst({ where: { teamId: ctx.teamId, deletedAt: null, dateDebut: { lte: jour }, dateFin: { gte: jour } }, select: { id: true } })
      seasonId = saison?.id ?? null
    }

    const rembourse = aRembourser(payeur.type)
    await tx.budgetExpense.create({
      data: {
        id,
        teamId: ctx.teamId,
        date: new Date(`${donnees.date}T00:00:00Z`),
        montant: donnees.montant,
        categoryId: donnees.categoryId,
        libelle: donnees.libelle || categorie.nom,
        payerId: donnees.payerId,
        moyen: donnees.moyen ?? null,
        eventId: donnees.eventId ?? null,
        entryId: donnees.entryId ?? null,
        seasonId,
        confirmee: confirmeeDOffice("saisie"),
        aRembourser: rembourse,
        remboursement: rembourse ? "a_rembourser" : "non_concerne",
        origine: "saisie",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  },
  async modifier(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = schemaDepense.parse(champs)
    const niveau = await niveauDe(ctx, "budget")
    const categorie = await tx.budgetCategory.findFirst({ where: { id: donnees.categoryId, teamId: ctx.teamId }, select: { nom: true } })
    const seasonId = await saisonDeLaDepense(tx, ctx, donnees.eventId ?? null, donnees.date)
    await modifierDepenseTx(
      tx,
      ctx,
      id,
      {
        montant: donnees.montant,
        categoryId: donnees.categoryId,
        libelle: donnees.libelle || categorie?.nom || "",
        payerId: donnees.payerId,
        date: new Date(`${donnees.date}T00:00:00Z`),
        eventId: donnees.eventId ?? null,
        entryId: donnees.entryId ?? null,
        seasonId,
        moyen: donnees.moyen ?? null,
      },
      niveau,
    )
    return true
  },
  async supprimer(tx: Tx, ctx: ContexteTeam, id) {
    const niveau = await niveauDe(ctx, "budget")
    await supprimerDepenseTx(tx, ctx, id, niveau)
    return true
  },
  // Après la validation : ce qui a été créé émet les événements de la dépense ; une modification ou une
  // suppression prévient le solde du payeur (même règle qu'en ligne).
  apresApplication: async (ctx: ContexteTeam, id: string, type: "creer" | "modifier" | "supprimer") => {
    if (type === "creer") return emettreDepenseSynchronisee(ctx, id)
    return emettreSoldeDepenseSynchronise(ctx, id)
  },
}

// Référentiels lus hors ligne : catégories et payeurs de la team.
function referentiel(cle: string, ficheType: string, niveauLecture: DeclarationSynchro["niveauLecture"], lirePaquet: DeclarationSynchro["lirePaquet"], trouver: DeclarationSynchro["trouver"]): DeclarationSynchro {
  return {
    cle,
    ficheType,
    app: "budget",
    niveauLecture,
    contributionPropre: false,
    lectureSeule: true,
    schemaChamps: z.object({}).strict(),
    lirePaquet,
    trouver,
    creer: refusLectureSeule,
    modifier: refusLectureSeule,
    supprimer: refusLectureSeule,
  }
}

const budgetCategorySynchro = referentiel(
  "budget_category",
  "categorie",
  "lecture",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.budgetCategory.findMany({ where: { teamId, ...apresPosition(position) }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limite })
    return lignes.map((l) => ({ ...socle(l), nom: l.nom, sens: l.sens, parentId: l.parentId, couleur: l.couleur, icone: l.icone, ordre: l.ordre, active: l.active }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.budgetCategory.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

const budgetPayerSynchro = referentiel(
  "budget_payer",
  "payeur",
  "contribution",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.budgetPayer.findMany({ where: { teamId, ...apresPosition(position) }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limite })
    return lignes.map((l) => ({ ...socle(l), type: l.type, personId: l.personId, nom: l.nom, actif: l.actif }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.budgetPayer.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

export const declarationsBudgetSynchro: DeclarationSynchro[] = [budgetExpenseSynchro, budgetCategorySynchro, budgetPayerSynchro]

// Tables de Budget lues hors ligne (le client les garde dans sa base locale).
export const TABLES_BUDGET_LECTURE_SEULE = ["budget_category", "budget_payer"] as const
