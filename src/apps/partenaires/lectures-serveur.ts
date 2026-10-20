// Lectures de Partenaires (tâche 3.5, brief section 6). Accès : niveau écriture (responsable et équipage).
// Le lien de la page partenaire est lu sans son jeton : seulement son état et ses compteurs.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"
import { lireRecettesParOrigineDans } from "@/apps/budget/liaisons-serveur"

import { accesPartenaires, normaliserNom } from "./services-serveur"
import { enRetard, jourParis, type StatutPartenaire } from "./regles"
import { bilanApport, rangDepuisOrigine, type BilanApport } from "./apport"

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
      contact: { select: { nom: true, adresse: true, telephone: true, email: true, site: true, siret: true } },
      interlocuteur: { select: { prenom: true, nom: true } },
      interactions: { where: { deletedAt: null }, orderBy: { date: "desc" }, include: { auteur: { select: { prenom: true, nom: true } } } },
      agreements: {
        where: { deletedAt: null },
        orderBy: { dateDebut: "desc" },
        include: {
          season: { select: { nom: true } },
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
    coordonnees: {
      adresse: partenaire.contact.adresse ?? "",
      telephone: partenaire.contact.telephone ?? "",
      email: partenaire.contact.email ?? "",
      site: partenaire.contact.site ?? "",
      siret: partenaire.contact.siret ?? "",
    },
    interlocuteur: partenaire.interlocuteur ? `${partenaire.interlocuteur.prenom} ${partenaire.interlocuteur.nom}` : null,
    // Prénom et nom à part, pour pré-remplir les deux champs du tiroir (brief 3.14, point 2).
    interlocuteurPrenom: partenaire.interlocuteur?.prenom ?? null,
    interlocuteurNom: partenaire.interlocuteur?.nom ?? null,
    interlocuteurQualite: partenaire.interlocuteurQualite,
    statut: partenaire.statut,
    source: partenaire.source,
    secteur: partenaire.secteur,
    notes: partenaire.notes,
    suiviParPersonId: partenaire.suiviParPersonId,
    logoFileId: partenaire.logoFileId,
    prochaineRelance: jourDe(partenaire.prochaineRelance),
    interactions: partenaire.interactions,
    // Chaque convention porte son apport : attendu, reçu, reste et versements (brief 3.14, point 4).
    conventions: await Promise.all(
      partenaire.agreements.map(async (convention) => ({
        ...convention,
        apport: await bilanApportDans(ctx, convention.id, convention.apportFinancierCentimes),
      })),
    ),
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
      season: { select: { id: true, nom: true } },
      template: { select: { id: true, nom: true, version: true } },
      benefits: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { proofs: { where: { deletedAt: null }, orderBy: { date: "desc" }, include: { event: { select: { nom: true } } } } },
      },
      amendments: { where: { deletedAt: null }, orderBy: { numero: "asc" } },
      precedente: { select: { id: true, dateDebut: true, dateFin: true, statut: true } },
      renouvellements: { where: { deletedAt: null }, select: { id: true, dateDebut: true, dateFin: true, statut: true } },
    },
  })
}

// Saisons de la team, la plus récente d'abord (liste du formulaire de convention).
export async function lireSaisons() {
  const { ctx } = await accesPartenaires("ecriture")
  return lireSaisonsDans(ctx)
}

export async function lireSaisonsDans(ctx: ContexteTeam) {
  return prismaPourTeam(ctx.teamId, ctx.userId).coreSeason.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { id: true, nom: true, enCours: true, dateDebut: true, dateFin: true },
    orderBy: { annee: "desc" },
  })
}

// Épreuves d'une saison, pour choisir celles qu'une contrepartie concerne.
export async function lireEpreuvesDeSaison(seasonId: string) {
  const { ctx } = await accesPartenaires("ecriture")
  return lireEpreuvesDeSaisonDans(ctx, seasonId)
}

export async function lireEpreuvesDeSaisonDans(ctx: ContexteTeam, seasonId: string) {
  return prismaPourTeam(ctx.teamId, ctx.userId).coreEvent.findMany({
    where: { teamId: ctx.teamId, seasonId, deletedAt: null },
    select: { id: true, nom: true, dateDebut: true },
    orderBy: { dateDebut: "asc" },
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
      conventionId: c.agreementId,
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

// Indice du formulaire « nouveau prospect », avant l'envoi : un contact de même nom existe-t-il déjà, et est-il
// déjà partenaire ? Même comparaison que creerProspect (normaliserNom), sans rien écrire.
export async function verifierEntreprise(nom: string) {
  const { ctx } = await accesPartenaires("ecriture")
  return verifierEntrepriseDans(ctx, nom)
}

export async function verifierEntrepriseDans(ctx: ContexteTeam, nom: string) {
  const cle = normaliserNom(nom)
  if (cle === "") return { contactExiste: false, partenaireId: null as string | null }
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const contacts = await client.coreContact.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, nom: true } })
  const contact = contacts.find((c) => normaliserNom(c.nom) === cle) ?? null
  const partenaire = contact
    ? await client.partenairesPartner.findFirst({ where: { teamId: ctx.teamId, contactId: contact.id, deletedAt: null }, select: { id: true } })
    : null
  return { contactExiste: contact !== null, partenaireId: partenaire?.id ?? null }
}

// Personnes de la team, pour « suivi par » et « auteur » des échanges.
export async function listerPersonnes() {
  const { ctx } = await accesPartenaires("ecriture")
  return listerPersonnesDans(ctx)
}

export async function listerPersonnesDans(ctx: ContexteTeam) {
  return prismaPourTeam(ctx.teamId, ctx.userId).corePerson.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { id: true, prenom: true, nom: true },
    orderBy: { prenom: "asc" },
  })
}

// Apport d'une convention (brief 3.14, point 4) : ses versements sont les recettes Budget d'origine
// « partenaires:<convention>:<rang> » (brief 3.11, §4). Lues par la liaison, jamais écrites ici.
export async function bilanApportDans(ctx: ContexteTeam, agreementId: string, attenduCentimes: number): Promise<BilanApport> {
  const recettes = await lireRecettesParOrigineDans(ctx, `partenaires:${agreementId}:`)
  const jourIso = (date: Date) => date.toISOString().slice(0, 10)
  return bilanApport({
    attenduCentimes,
    aujourdhui: jourParis(new Date()),
    versements: recettes.map((recette) => ({
      id: recette.id,
      rang: rangDepuisOrigine(recette.origineRef),
      date: jourIso(recette.date),
      montantCentimes: recette.montant,
      statut: recette.statut,
      encaisseeLe: recette.encaisseeLe ? jourIso(recette.encaisseeLe) : null,
    })),
  })
}

export async function lireBilanApport(agreementId: string, attenduCentimes: number): Promise<BilanApport> {
  const { ctx } = await accesPartenaires("ecriture")
  return bilanApportDans(ctx, agreementId, attenduCentimes)
}
