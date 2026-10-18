// Lectures de Partenaires (tâche 3.5, brief section 6). Accès : niveau écriture (responsable et équipage).
// Le lien de la page partenaire est lu sans son jeton : seulement son état et ses compteurs.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { accesPartenaires } from "./services-serveur"
import { enRetard, jourParis, type StatutPartenaire } from "./regles"

const STATUTS_ACTIFS = ["signee", "en_cours"] as const

function jourDe(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

// Saison en cours de la team, ou null s'il n'y en a pas.
async function saisonEnCoursDans(ctx: ContexteTeam) {
  return prismaPourTeam(ctx.teamId, ctx.userId).coreSeason.findFirst({
    where: { teamId: ctx.teamId, enCours: true, deletedAt: null },
    select: { id: true, nom: true },
  })
}

export async function listerPartenaires(filtre: { statut?: StatutPartenaire } = {}) {
  const { ctx } = await accesPartenaires("ecriture")
  return listerPartenairesDans(ctx, filtre)
}

export async function listerPartenairesDans(ctx: ContexteTeam, filtre: { statut?: StatutPartenaire } = {}) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const saison = await saisonEnCoursDans(ctx)
  const partenaires = await client.partenairesPartner.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, ...(filtre.statut ? { statut: filtre.statut } : {}) },
    include: {
      contact: { select: { nom: true } },
      interlocuteur: { select: { prenom: true, nom: true } },
      suiviPar: { select: { prenom: true, nom: true } },
      agreements: {
        where: { deletedAt: null, statut: { in: [...STATUTS_ACTIFS] } },
        select: { seasonId: true, apportFinancierCentimes: true },
      },
    },
    orderBy: { prochaineRelance: "asc" },
  })
  return partenaires.map((p) => ({
    id: p.id,
    entreprise: p.contact.nom,
    interlocuteur: p.interlocuteur ? `${p.interlocuteur.prenom} ${p.interlocuteur.nom}` : null,
    statut: p.statut,
    prochaineRelance: jourDe(p.prochaineRelance),
    suiviPar: p.suiviPar ? `${p.suiviPar.prenom} ${p.suiviPar.nom}` : null,
    conventionsActives: p.agreements.length,
    apportSaisonCentimes: saison
      ? p.agreements.filter((a) => a.seasonId === saison.id).reduce((somme, a) => somme + a.apportFinancierCentimes, 0)
      : 0,
  }))
}

export async function lirePartenaire(id: string) {
  const { ctx } = await accesPartenaires("ecriture")
  return lirePartenaireDans(ctx, id)
}

export async function lirePartenaireDans(ctx: ContexteTeam, id: string) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const partenaire = await client.partenairesPartner.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    include: {
      contact: { select: { nom: true, adresse: true } },
      interlocuteur: { select: { prenom: true, nom: true } },
      interactions: { where: { deletedAt: null }, orderBy: { date: "desc" } },
      agreements: {
        where: { deletedAt: null },
        orderBy: { dateDebut: "desc" },
        include: {
          benefits: { where: { deletedAt: null }, include: { proofs: { where: { deletedAt: null } } } },
          amendments: { where: { deletedAt: null }, orderBy: { numero: "asc" } },
        },
      },
      reports: { where: { deletedAt: null }, orderBy: { genereLe: "desc" } },
      portalLinks: {
        where: { actif: true, deletedAt: null },
        select: { id: true, actif: true, derniereConsultation: true, nbConsultations: true, sections: true, expireLe: true },
      },
      messages: { where: { deletedAt: null }, orderBy: { date: "desc" } },
    },
  })
  if (!partenaire) return null
  return {
    id: partenaire.id,
    entreprise: partenaire.contact.nom,
    adresse: partenaire.contact.adresse,
    interlocuteur: partenaire.interlocuteur ? `${partenaire.interlocuteur.prenom} ${partenaire.interlocuteur.nom}` : null,
    statut: partenaire.statut,
    source: partenaire.source,
    secteur: partenaire.secteur,
    notes: partenaire.notes,
    prochaineRelance: jourDe(partenaire.prochaineRelance),
    interactions: partenaire.interactions,
    conventions: partenaire.agreements,
    bilans: partenaire.reports,
    // Sans jeton : seulement l'état du lien et ses compteurs.
    lienPage: partenaire.portalLinks[0] ?? null,
    messages: partenaire.messages,
  }
}

export async function lireConvention(id: string) {
  const { ctx } = await accesPartenaires("ecriture")
  return lireConventionDans(ctx, id)
}

export async function lireConventionDans(ctx: ContexteTeam, id: string) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  return client.partenairesAgreement.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    include: {
      partner: { include: { contact: { select: { nom: true } } } },
      benefits: { where: { deletedAt: null }, include: { proofs: { where: { deletedAt: null } } } },
      amendments: { where: { deletedAt: null }, orderBy: { numero: "asc" } },
    },
  })
}

// Vue globale des contreparties, avec l'avancement : « en retard » s'ajoute aux statuts stockés.
export async function listerContreparties(filtre: { saisonId?: string | null } = {}) {
  const { ctx } = await accesPartenaires("ecriture")
  return listerContrepartiesDans(ctx, filtre)
}

export async function listerContrepartiesDans(ctx: ContexteTeam, filtre: { saisonId?: string | null } = {}) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const aujourdhui = jourParis(new Date())
  const contreparties = await client.partenairesBenefit.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      agreement: { deletedAt: null, ...(filtre.saisonId ? { seasonId: filtre.saisonId } : {}) },
    },
    include: { agreement: { include: { partner: { include: { contact: { select: { nom: true } } } } } } },
    orderBy: { echeance: "asc" },
  })
  return contreparties.map((c) => {
    const echeance = jourDe(c.echeance)
    const retard = echeance !== null && enRetard({ statut: c.statut, quantitePromise: c.quantitePromise, quantiteTenue: c.quantiteTenue, echeance }, aujourdhui)
    return {
      id: c.id,
      libelle: c.libelle,
      type: c.type,
      entreprise: c.agreement.partner.contact.nom,
      quantitePromise: c.quantitePromise,
      quantiteTenue: c.quantiteTenue,
      echeance,
      statut: retard ? ("en_retard" as const) : c.statut,
    }
  })
}
