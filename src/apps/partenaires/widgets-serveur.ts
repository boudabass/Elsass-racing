// Widgets de Partenaires (tâche 3.5, brief section 6) : trois lectures du catalogue, sans affichage
// (le tableau de bord arrive au lot 6). Chacune a sa variante « …Dans(ctx, …) » pour être testée en base.
// Sans accès, un widget renvoie null, comme Voiture.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { enRetard, jourParis } from "./regles"
import { accesPartenaires } from "./services-serveur"

function ajouterJours(jour: string, jours: number): string {
  const date = new Date(`${jour}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + jours)
  return date.toISOString().slice(0, 10)
}

// Relances dues d'ici sept jours (aujourd'hui compris), hors partenaires déjà acquis ou refusés.
export async function widgetRelancesSemaine() {
  const { ctx } = await accesPartenaires("ecriture")
  return widgetRelancesSemaineDans(ctx)
}

export async function widgetRelancesSemaineDans(ctx: ContexteTeam) {
  const aujourdhui = jourParis(new Date())
  const limite = ajouterJours(aujourdhui, 7)
  const relances = await prismaPourTeam(ctx.teamId, ctx.userId).partenairesPartner.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      prochaineRelance: { lte: new Date(`${limite}T00:00:00Z`) },
      statut: { notIn: ["partenaire", "ancien_partenaire", "refus"] },
    },
    include: { contact: { select: { nom: true } } },
    orderBy: { prochaineRelance: "asc" },
  })
  return {
    nombre: relances.length,
    premier: relances[0] ? { entreprise: relances[0].contact.nom, date: relances[0].prochaineRelance?.toISOString().slice(0, 10) ?? null } : null,
  }
}

// Contreparties en retard, tous partenaires confondus.
export async function widgetContrepartiesEnRetard() {
  const { ctx } = await accesPartenaires("ecriture")
  return widgetContrepartiesEnRetardDans(ctx)
}

export async function widgetContrepartiesEnRetardDans(ctx: ContexteTeam) {
  const aujourdhui = jourParis(new Date())
  const contreparties = await prismaPourTeam(ctx.teamId, ctx.userId).partenairesBenefit.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      echeance: { lt: new Date(`${aujourdhui}T00:00:00Z`) },
      statut: { notIn: ["tenue", "reportee"] },
      agreement: { deletedAt: null, statut: { in: ["signee", "en_cours"] } },
    },
    include: { agreement: { include: { partner: { include: { contact: { select: { nom: true } } } } } } },
  })
  const retards = contreparties.flatMap((c) => {
    const echeance = c.echeance?.toISOString().slice(0, 10) ?? null
    if (!echeance || !enRetard({ statut: c.statut, quantitePromise: c.quantitePromise, quantiteTenue: c.quantiteTenue, echeance }, aujourdhui)) return []
    return [{ libelle: c.libelle, entreprise: c.agreement.partner.contact.nom, echeance }]
  })
  return { nombre: retards.length, premier: retards[0] ?? null }
}

// Partenaires actifs et apports de la saison en cours.
export async function widgetPartenairesActifs() {
  const { ctx } = await accesPartenaires("ecriture")
  return widgetPartenairesActifsDans(ctx)
}

export async function widgetPartenairesActifsDans(ctx: ContexteTeam) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const saison = await client.coreSeason.findFirst({ where: { teamId: ctx.teamId, enCours: true, deletedAt: null }, select: { id: true, nom: true } })
  const actifs = await client.partenairesPartner.count({ where: { teamId: ctx.teamId, deletedAt: null, statut: "partenaire" } })
  const apports = saison
    ? await client.partenairesAgreement.aggregate({
        where: { teamId: ctx.teamId, deletedAt: null, seasonId: saison.id, statut: { in: ["signee", "en_cours", "terminee"] } },
        _sum: { apportFinancierCentimes: true },
      })
    : null
  return {
    partenairesActifs: actifs,
    saison: saison?.nom ?? null,
    apportSaisonCentimes: apports?._sum.apportFinancierCentimes ?? 0,
  }
}
