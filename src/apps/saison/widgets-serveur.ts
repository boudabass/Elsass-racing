// Lectures des widgets de Saison, et de la prochaine épreuve du QG (une seule source de vérité :
// prochaineEpreuve, règle de regles.ts). Elles prennent le contexte de l'appelant : pas de garde
// d'écran ici, le QG est déjà gardé. Le niveau sert à ne rien compter qu'on ne peut pas valider.

import { prismaPourTeam } from "@/lib/prisma"
import type { ContexteTeam } from "@/core/contexte"
import { niveauDe } from "@/core/actions/actions-serveur"
import { libelleCompteARebours } from "@/core/actions/prochaine-etape"
import { aAuMoins } from "@/core/droits/niveaux"

import { bilanSaison, type EngagementBilan } from "./regles-resultats"
import { indicePourEngagement, pointsDePreparation } from "./preparation"
import { jourDeParis, prochaineEpreuve, transitionResultat, type RoleMembre, type StatutEngagement, type StatutEpreuve, type StatutResultat, type ValidationResultat } from "./regles"
import { libelleBilan, libelleResultatsAValider, resumerPreparation } from "./widgets"

// Prochaine épreuve de la team : engagée en priorité, sinon la prochaine à venir. Utilisée par le QG
// (compte à rebours de la barre haute, bouton Prochaine étape) et par le calendrier de Saison.
export async function prochaineEpreuveDeLEquipe(ctx: ContexteTeam, maintenant: Date) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const aujourdhui = new Date(`${jourDeParis(maintenant)}T00:00:00Z`)
  const epreuves = await client.coreEvent.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, statut: { not: "annulee" }, dateFin: { gte: aujourdhui } },
    select: {
      id: true,
      nom: true,
      type: true,
      lieu: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      entries: { where: { deletedAt: null }, select: { statut: true } },
    },
    orderBy: [{ dateDebut: "asc" }, { id: "asc" }],
  })

  const choisie = prochaineEpreuve(
    epreuves.map((epreuve) => ({
      ...epreuve,
      statut: epreuve.statut as StatutEpreuve,
      engagements: epreuve.entries.map((entree) => entree.statut as StatutEngagement),
    })),
    maintenant,
  )
  if (!choisie) return null
  return { id: choisie.id, nom: choisie.nom, type: choisie.type, lieu: choisie.lieu, dateDebut: choisie.dateDebut, dateFin: choisie.dateFin, statut: choisie.statut }
}

export async function widgetProchaineEpreuve(ctx: ContexteTeam, maintenant: Date) {
  const epreuve = await prochaineEpreuveDeLEquipe(ctx, maintenant)
  if (!epreuve) return null
  return {
    nom: epreuve.nom,
    lieu: epreuve.lieu,
    dateDebut: epreuve.dateDebut,
    compteARebours: libelleCompteARebours({ nom: epreuve.nom, dateDebut: epreuve.dateDebut }, maintenant),
  }
}

// Préparation de la prochaine épreuve : le résumé des engagements (le moins prêt donne le ton).
export async function widgetPretPourEpreuve(ctx: ContexteTeam, maintenant: Date) {
  const epreuve = await prochaineEpreuveDeLEquipe(ctx, maintenant)
  if (!epreuve) return null
  const entrees = await prismaPourTeam(ctx.teamId, ctx.userId).coreEventEntry.findMany({
    where: { eventId: epreuve.id, teamId: ctx.teamId, deletedAt: null, statut: { notIn: ["abandon", "forfait"] } },
    select: {
      saisonRegistration: { select: { payeLe: true } },
      saisonReadiness: { select: { point: true, statut: true, detail: true } },
    },
  })
  const indices = entrees.flatMap((entree) => {
    const indice = indicePourEngagement(pointsDePreparation(entree.saisonRegistration?.payeLe != null, entree.saisonReadiness), maintenant, epreuve.dateDebut)
    return indice ? [indice] : []
  })
  return { nom: epreuve.nom, indice: resumerPreparation(indices), nombreEngagements: entrees.length }
}

// Résultats que ce membre peut valider (saison ouverte) : même règle que la boîte d'actions.
export async function widgetResultatsAValider(ctx: ContexteTeam) {
  const niveau = await niveauDe(ctx, "saison")
  if (!aAuMoins(niveau, "ecriture")) return { nombre: 0, libelle: libelleResultatsAValider(0) }
  const resultats = await prismaPourTeam(ctx.teamId, ctx.userId).saisonResult.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      validation: { in: ["saisi", "a_verifier"] },
      entry: { event: { season: { clotureeAt: null } } },
    },
    select: { validation: true, saisiParMembershipId: true },
  })
  const acteur = { membershipId: ctx.membership.id, role: ctx.membership.role as RoleMembre }
  const nombre = resultats.filter(
    (resultat) =>
      transitionResultat({ validation: resultat.validation as ValidationResultat, saisiParMembershipId: resultat.saisiParMembershipId }, { type: "valider" }, acteur).ok,
  ).length
  return { nombre, libelle: libelleResultatsAValider(nombre) }
}

// Bilan de la saison en cours (résultats validés seuls, comme l'historique).
export async function widgetBilanSaison(ctx: ContexteTeam) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const saison = await client.coreSeason.findFirst({
    where: { teamId: ctx.teamId, enCours: true, deletedAt: null },
    select: { id: true, nom: true },
  })
  if (!saison) return null
  const epreuves = await client.coreEvent.findMany({
    where: { teamId: ctx.teamId, seasonId: saison.id, deletedAt: null, statut: { not: "annulee" } },
    select: {
      entries: {
        where: { deletedAt: null },
        select: {
          statut: true,
          saisonResult: { select: { validation: true, statutFinal: true, kmChronometres: true } },
        },
      },
    },
  })
  const engagements: EngagementBilan[] = epreuves.flatMap((epreuve) =>
    epreuve.entries.map((entree) => ({
      statut: entree.statut,
      validation: (entree.saisonResult?.validation as ValidationResultat | undefined) ?? null,
      statutFinal: (entree.saisonResult?.statutFinal as StatutResultat | undefined) ?? null,
      kmChronometres: entree.saisonResult?.kmChronometres ? Number(entree.saisonResult.kmChronometres) : null,
    })),
  )
  const bilan = bilanSaison(engagements)
  return { nom: saison.nom, bilan, libelle: libelleBilan(bilan) }
}
