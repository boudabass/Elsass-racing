// Lectures des écrans de Saison. Toutes passent par accesSaison (niveau lecture au moins) et
// renvoient le niveau effectif : l'écran s'en sert pour n'afficher aucun bouton d'écriture.
// Les montants (inscription, tarifs) passent par masquerMontants : jamais un simple masquage CSS.

import { jourDeParis } from "@/core/dates"
import { prismaPourTeam } from "@/lib/prisma"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

import {
  clotureProposee,
  masquerMontants,
  transitionResultat,
  type EpreuvePourCloture,
  type RoleMembre,
  type StatutEngagement,
  type StatutEpreuve,
  type StatutResultat,
  type ValidationResultat,
} from "./regles"
import {
  STATUTS_PARTIS,
  bilanSaison,
  peutVoirDebriefs,
  statistiquesCarriere,
  type EngagementBilan,
  type ResultatCarriere,
} from "./regles-resultats"
import { accesSaison } from "./services-serveur"
import { indicePourEngagement, pointsDePreparation } from "./preparation"
import { lirePointsEquipe } from "./preparation-equipe-serveur"
import { lireSurveillance } from "@/apps/garage/lectures-partagees"


export async function lireAcces(): Promise<{ niveau: Niveau }> {
  const { niveau } = await accesSaison("lecture")
  return { niveau }
}

export async function listerSaisons() {
  const { ctx, niveau } = await accesSaison("lecture")
  const saisons = await prismaPourTeam(ctx.teamId, ctx.userId).coreSeason.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    orderBy: { annee: "desc" },
    select: { id: true, annee: true, nom: true, enCours: true, clotureeAt: true },
  })
  return { niveau, saisons }
}

// Épreuves d'une saison, avec leurs engagements (statut et validation du résultat) pour « Reste à faire ».
export async function listerEpreuves(seasonId: string | null) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuves = await client.coreEvent.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, ...(seasonId ? { seasonId } : {}) },
    orderBy: [{ dateDebut: "asc" }, { id: "asc" }],
    select: {
      id: true,
      nom: true,
      type: true,
      lieu: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      seasonId: true,
      entries: {
        where: { deletedAt: null },
        select: { statut: true, saisonResult: { select: { validation: true } } },
      },
    },
  })
  return {
    niveau,
    epreuves: epreuves.map((epreuve) => ({
      ...epreuve,
      engagements: epreuve.entries.map((entree) => ({
        statut: entree.statut,
        resultat: entree.saisonResult?.validation ?? null,
      })),
      entries: undefined,
    })),
  }
}

// Fiche d'une épreuve : infos (tarifs masqués sous lecture), spéciales, programme, engagements.
export async function lireEpreuve(eventId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({
    where: { id: eventId, teamId: ctx.teamId, deletedAt: null },
    include: {
      saisonInfo: true,
      saisonStages: { where: { deletedAt: null }, orderBy: { numero: "asc" } },
      saisonScheduleItems: { where: { deletedAt: null }, orderBy: { heurePrevue: "asc" } },
      entries: {
        where: { deletedAt: null },
        include: { vehicle: { select: { nomCourt: true } }, pilote: { select: { prenom: true, nom: true } }, copilote: { select: { prenom: true, nom: true } } },
        orderBy: { createdAt: "asc" },
      },
      season: { select: { annee: true, nom: true, clotureeAt: true } },
    },
  })
  // Saison masquée (relation vue à null) : traitée comme une épreuve absente.
  if (!epreuve?.season) return null

  const kmSpeciales = epreuve.saisonStages.reduce((total, stage) => total + Number(stage.longueurKm ?? 0) * (stage.nbPassages ?? 1), 0)
  return {
    niveau,
    saisonCloturee: epreuve.season.clotureeAt !== null,
    epreuve: {
      id: epreuve.id,
      nom: epreuve.nom,
      type: epreuve.type,
      lieu: epreuve.lieu,
      departement: epreuve.departement,
      lienOfficiel: epreuve.lienOfficiel,
      organisateurContactId: epreuve.organisateurContactId,
      statut: epreuve.statut,
      dateDebut: epreuve.dateDebut,
      dateFin: epreuve.dateFin,
      saison: epreuve.season,
    },
    infos: epreuve.saisonInfo ? masquerMontants(epreuve.saisonInfo, niveau) : null,
    speciales: epreuve.saisonStages,
    programme: epreuve.saisonScheduleItems,
    kmChronometresTotal: Math.round(kmSpeciales * 10) / 10,
    engagements: epreuve.entries.map((entree) => ({
      id: entree.id,
      statut: entree.statut,
      numeroCourse: entree.numeroCourse,
      groupe: entree.groupe,
      classe: entree.classe,
      voiture: entree.vehicle.nomCourt,
      pilote: entree.pilote ? `${entree.pilote.prenom} ${entree.pilote.nom}` : null,
      copilote: entree.copilote ? `${entree.copilote.prenom} ${entree.copilote.nom}` : null,
    })),
  }
}

// Fiche d'un engagement : voiture, équipage, fiche et inscription (montants masqués sous lecture).
export async function lireEngagement(entryId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: entryId, teamId: ctx.teamId, deletedAt: null },
    include: {
      event: { select: { id: true, nom: true, dateDebut: true, statut: true, season: { select: { clotureeAt: true } } } },
      vehicle: { select: { nomCourt: true } },
      pilote: { select: { prenom: true, nom: true } },
      copilote: { select: { prenom: true, nom: true } },
      saisonRegistration: true,
    },
  })
  // Épreuve ou saison masquée (relation vue à null) : traité comme un engagement absent.
  if (!engagement?.event?.season) return null

  return {
    niveau,
    saisonCloturee: engagement.event.season.clotureeAt !== null,
    engagement: {
      id: engagement.id,
      statut: engagement.statut,
      numeroCourse: engagement.numeroCourse,
      groupe: engagement.groupe,
      classe: engagement.classe,
      voiture: engagement.vehicle.nomCourt,
      pilote: engagement.pilote ? `${engagement.pilote.prenom} ${engagement.pilote.nom}` : null,
      copilote: engagement.copilote ? `${engagement.copilote.prenom} ${engagement.copilote.nom}` : null,
      epreuve: { id: engagement.event.id, nom: engagement.event.nom, dateDebut: engagement.event.dateDebut, statut: engagement.event.statut },
    },
    inscription: engagement.saisonRegistration ? masquerMontants(engagement.saisonRegistration, niveau) : null,
  }
}

// Voitures de course actives et personnes de la team, pour les listes de l'engagement.
export async function listerChoixEngagement() {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [voitures, personnes] = await Promise.all([
    client.coreVehicle.findMany({
      where: { teamId: ctx.teamId, deletedAt: null, actif: true, type: "course" },
      select: { id: true, nomCourt: true },
      orderBy: { nomCourt: "asc" },
    }),
    client.corePerson.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      select: { id: true, prenom: true, nom: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
  ])
  return { niveau, voitures, personnes }
}

// --- Tâche 2.3 : résultats, à valider, fin d'épreuve, débriefs, historique -----------------------

const ENTREES_RESULTAT = ["saisi", "a_verifier", "conteste"] as const

// Qui peut valider ce résultat, et s'il s'agit de sa propre saisie : même règle que le service.
// Saison clôturée (ouverte = false) : rien ne se valide ni ne se conteste.
function droitsResultat(
  resultat: { validation: string; saisiParMembershipId: string | null },
  acteur: { membershipId: string; role: RoleMembre },
  niveau: Niveau,
  ouverte = true,
) {
  const ecriture = aAuMoins(niveau, "ecriture") && ouverte
  const valider = ecriture && transitionResultat(
    { validation: resultat.validation as "saisi", saisiParMembershipId: resultat.saisiParMembershipId },
    { type: "valider" },
    acteur,
  ).ok
  const estAuteur = resultat.saisiParMembershipId === acteur.membershipId
  const messageValidation =
    !valider && estAuteur && (resultat.validation === "saisi" || resultat.validation === "a_verifier")
      ? "Un autre membre doit valider ce résultat."
      : null
  return {
    peutValider: valider,
    peutContester: ecriture && resultat.validation === "valide",
    messageValidation,
    estAuteur,
  }
}

export async function listerContacts() {
  const { ctx, niveau } = await accesSaison("lecture")
  const contacts = await prismaPourTeam(ctx.teamId, ctx.userId).coreContact.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  })
  return { niveau, contacts }
}

// Résultats des engagements partis ou terminés d'une épreuve, avec ce que ce membre peut en faire.
export async function lireResultatsEpreuve(eventId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({
    where: { id: eventId, teamId: ctx.teamId, deletedAt: null },
    select: {
      id: true,
      nom: true,
      season: { select: { clotureeAt: true } },
      entries: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          statut: true,
          numeroCourse: true,
          vehicle: { select: { nomCourt: true } },
          pilote: { select: { prenom: true, nom: true } },
          copilote: { select: { prenom: true, nom: true } },
          saisonResult: true,
        },
      },
    },
  })
  // Saison masquée (relation vue à null) : traitée comme une épreuve absente.
  if (!epreuve?.season) return null
  const speciales = await client.saisonStage.findMany({
    where: { eventId, teamId: ctx.teamId, deletedAt: null },
    select: { id: true, numero: true, nom: true },
    orderBy: { numero: "asc" },
  })
  const acteur = { membershipId: ctx.membership.id, role: ctx.membership.role as RoleMembre }
  const saisonCloturee = epreuve.season.clotureeAt !== null

  return {
    niveau,
    saisonCloturee,
    epreuve: { id: epreuve.id, nom: epreuve.nom },
    speciales,
    engagements: epreuve.entries
      .filter((entree) => (STATUTS_PARTIS as readonly string[]).includes(entree.statut) || entree.saisonResult !== null)
      .map((entree) => {
        const resultat = entree.saisonResult
        return {
          id: entree.id,
          voiture: entree.vehicle.nomCourt,
          numeroCourse: entree.numeroCourse,
          equipage: [entree.pilote, entree.copilote].filter(Boolean).map((p) => `${p!.prenom} ${p!.nom}`).join(" / ") || null,
          statut: entree.statut,
          resultat: resultat
            ? {
                statutFinal: resultat.statutFinal,
                validation: resultat.validation,
                classementGeneral: resultat.classementGeneral,
                nbClasses: resultat.nbClasses,
                classementGroupe: resultat.classementGroupe,
                classementClasse: resultat.classementClasse,
                nbPartantsClasse: resultat.nbPartantsClasse,
                tempsTotalMs: resultat.tempsTotalMs,
                penalitesMs: resultat.penalitesMs,
                kmChronometres: resultat.kmChronometres?.toString() ?? null,
                causeAbandon: resultat.causeAbandon,
                stageAbandonId: resultat.stageAbandonId,
                public: resultat.public,
                preuveLien: resultat.preuveLien,
                preuveFileId: resultat.preuveFileId,
                commentaireContestation: resultat.commentaireContestation,
              }
            : null,
          droits: resultat ? droitsResultat(resultat, acteur, niveau, !saisonCloturee) : null,
        }
      }),
  }
}

// Résultats qui attendent une décision (saisis, à vérifier ou contestés), du plus ancien au plus récent.
export async function listerResultatsAValider() {
  const { ctx, niveau } = await accesSaison("lecture")
  const acteur = { membershipId: ctx.membership.id, role: ctx.membership.role as RoleMembre }
  const resultats = await prismaPourTeam(ctx.teamId, ctx.userId).saisonResult.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, validation: { in: [...ENTREES_RESULTAT] }, entry: { event: { season: { clotureeAt: null } } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      entryId: true,
      validation: true,
      statutFinal: true,
      saisiParMembershipId: true,
      preuveLien: true,
      preuveFileId: true,
      createdAt: true,
      entry: { select: { id: true, event: { select: { id: true, nom: true } }, vehicle: { select: { nomCourt: true } } } },
    },
  })
  return {
    niveau,
    resultats: resultats.map((resultat) => ({
      entryId: resultat.entryId,
      epreuveId: resultat.entry.event.id,
      epreuve: resultat.entry.event.nom,
      voiture: resultat.entry.vehicle.nomCourt,
      validation: resultat.validation,
      statutFinal: resultat.statutFinal,
      // Une preuve peut être un lien ou un fichier (brief 3.3).
      sansPreuve: !resultat.preuveLien && !resultat.preuveFileId,
      preuveFileId: resultat.preuveFileId,
      droits: droitsResultat(resultat, acteur, niveau),
    })),
  }
}

// Compteur à côté de l'entrée « Résultats à valider » (les seuls que ce membre peut traiter).
export async function compterResultatsAValider(): Promise<number> {
  const { ctx, niveau } = await accesSaison("lecture")
  const acteur = { membershipId: ctx.membership.id, role: ctx.membership.role as RoleMembre }
  const resultats = await prismaPourTeam(ctx.teamId, ctx.userId).saisonResult.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, validation: { in: [...ENTREES_RESULTAT] }, entry: { event: { season: { clotureeAt: null } } } },
    select: { validation: true, saisiParMembershipId: true },
  })
  return resultats.filter((resultat) => droitsResultat(resultat, acteur, niveau).peutValider).length
}

// Écran de fin d'épreuve : seulement pour un résultat validé. Tout vient des données validées.
export async function lireFinDEpreuve(entryId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const entree = await client.coreEventEntry.findFirst({
    where: { id: entryId, teamId: ctx.teamId, deletedAt: null },
    select: {
      event: { select: { id: true, nom: true, seasonId: true } },
      saisonResult: true,
    },
  })
  const resultat = entree?.saisonResult
  if (!entree || !resultat || resultat.validation !== "valide") return null

  const kmSaison = await client.saisonResult.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, validation: "valide", entry: { event: { seasonId: entree.event.seasonId } } },
    select: { kmChronometres: true },
  })
  const debrief = await client.saisonDebrief.findFirst({
    where: { entryId, auteurMembershipId: ctx.membership.id, teamId: ctx.teamId, deletedAt: null },
    select: { id: true },
  })
  return {
    niveau,
    epreuve: entree.event.nom,
    statutFinal: resultat.statutFinal,
    classementGeneral: resultat.classementGeneral,
    classementClasse: resultat.classementClasse,
    nbPartantsClasse: resultat.nbPartantsClasse,
    kmChronometres: resultat.kmChronometres?.toString() ?? null,
    kmSaison: Math.round(kmSaison.reduce((total, ligne) => total + Number(ligne.kmChronometres ?? 0), 0) * 10) / 10,
    aDebrief: debrief !== null,
    sansPreuve: !resultat.preuveLien && !resultat.preuveFileId,
    preuveFileId: resultat.preuveFileId,
  }
}

// Débriefs d'un engagement : réservés au responsable et à l'équipage (jamais à l'assistance).
export async function lireDebriefs(entryId: string) {
  const { ctx } = await accesSaison("lecture")
  if (!peutVoirDebriefs(ctx.membership.role)) return []
  const debriefs = await prismaPourTeam(ctx.teamId, ctx.userId).saisonDebrief.findMany({
    where: { entryId, teamId: ctx.teamId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ressenti: true,
      pointsPositifs: true,
      pointsAAmeliorer: true,
      problemesVoiture: true,
      auteurMembershipId: true,
      auteur: { select: { person: { select: { prenom: true, nom: true } } } },
    },
  })
  return debriefs.map((debrief) => ({
    id: debrief.id,
    ressenti: debrief.ressenti,
    pointsPositifs: debrief.pointsPositifs,
    pointsAAmeliorer: debrief.pointsAAmeliorer,
    problemesVoiture: debrief.problemesVoiture,
    auteur: debrief.auteur.person ? `${debrief.auteur.person.prenom} ${debrief.auteur.person.nom}` : "Membre de l'équipage",
    estMoi: debrief.auteurMembershipId === ctx.membership.id,
  }))
}

// Historique : bilan de chaque saison (résultats validés seuls), carrière par personne et par voiture.
export async function lireHistorique() {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [saisons, epreuves, personnes, voitures] = await Promise.all([
    client.coreSeason.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      orderBy: { annee: "desc" },
      select: { id: true, annee: true, nom: true, enCours: true, clotureeAt: true },
    }),
    client.coreEvent.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      select: {
        id: true,
        seasonId: true,
        statut: true,
        dateDebut: true,
        entries: {
          where: { deletedAt: null },
          select: {
            id: true,
            statut: true,
            piloteId: true,
            copiloteId: true,
            vehicleId: true,
            saisonResult: { select: { validation: true, statutFinal: true, kmChronometres: true, classementClasse: true } },
          },
        },
      },
    }),
    client.corePerson.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, prenom: true, nom: true } }),
    client.coreVehicle.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, nomCourt: true } }),
  ])

  const resultatsCarriere: ResultatCarriere[] = []
  const saisonsBilan = saisons.map((saison) => {
    const epreuvesSaison = epreuves.filter((epreuve) => epreuve.seasonId === saison.id)
    const engagements: EngagementBilan[] = []
    for (const epreuve of epreuvesSaison) {
      for (const entree of epreuve.entries) {
        const resultat = entree.saisonResult
        engagements.push({
          statut: entree.statut,
          validation: (resultat?.validation as ValidationResultat | undefined) ?? null,
          statutFinal: (resultat?.statutFinal as StatutResultat | undefined) ?? null,
          kmChronometres: resultat?.kmChronometres ? Number(resultat.kmChronometres) : null,
        })
        if (resultat?.validation === "valide") {
          resultatsCarriere.push({
            epreuveId: epreuve.id,
            piloteId: entree.piloteId,
            copiloteId: entree.copiloteId,
            voitureId: entree.vehicleId,
            validation: "valide",
            statutFinal: resultat.statutFinal as StatutResultat,
            kmChronometres: resultat.kmChronometres ? Number(resultat.kmChronometres) : null,
            classementClasse: resultat.classementClasse,
          })
        }
      }
    }
    const pourCloture: EpreuvePourCloture[] = epreuvesSaison.map((epreuve) => ({
      statut: epreuve.statut as StatutEpreuve,
      dateDebut: epreuve.dateDebut,
      engagements: epreuve.entries.map((entree) => ({
        statut: entree.statut as StatutEngagement,
        validation: (entree.saisonResult?.validation as ValidationResultat | undefined) ?? null,
      })),
    }))
    return {
      id: saison.id,
      annee: saison.annee,
      nom: saison.nom,
      enCours: saison.enCours,
      clotureeAt: saison.clotureeAt,
      epreuves: epreuvesSaison.filter((epreuve) => epreuve.statut !== "annulee").length,
      bilan: bilanSaison(engagements),
      clotureProposee: clotureProposee(pourCloture, saison.clotureeAt !== null),
    }
  })

  const carriere = statistiquesCarriere(resultatsCarriere)
  const nomPersonne = new Map(personnes.map((p) => [p.id, `${p.prenom} ${p.nom}`]))
  const nomVoiture = new Map(voitures.map((v) => [v.id, v.nomCourt]))
  return {
    niveau,
    saisons: saisonsBilan,
    personnes: carriere.personnes.map((s) => ({ ...s, nom: nomPersonne.get(s.cle) ?? "Membre" })),
    voitures: carriere.voitures.map((s) => ({ ...s, nom: nomVoiture.get(s.cle) ?? "Voiture" })),
    prochaineAnnee: saisons.length > 0 ? Math.max(...saisons.map((s) => s.annee)) + 1 : new Date().getUTCFullYear(),
  }
}

// --- Tâche 2.4 : préparation pour l'épreuve (sans montants : seulement les points et l'indice) ---

// Un panneau par engagement de l'épreuve : indice, points (réglé, ouvert, pas encore suivi).
export async function lirePreparation(eventId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const epreuve = await prismaPourTeam(ctx.teamId, ctx.userId).coreEvent.findFirst({
    where: { id: eventId, teamId: ctx.teamId, deletedAt: null },
    select: {
      dateDebut: true,
      entries: {
        where: { deletedAt: null, statut: { notIn: ["abandon", "forfait"] } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          statut: true,
          vehicleId: true,
          piloteId: true,
          copiloteId: true,
          vehicle: { select: { nomCourt: true } },
          saisonRegistration: { select: { payeLe: true } },
          saisonReadiness: { select: { point: true, statut: true, detail: true } },
        },
      },
    },
  })
  if (!epreuve) return null

  const maintenant = new Date()
  // Point à surveiller : l'état actuel chez Garage, lu seulement si Garage est activé et accessible (954 v1.4, §5).
  const surveillances = await Promise.all(epreuve.entries.map((entree) => lireSurveillance(ctx, entree.vehicleId)))
  // Licences et homologations : lues chez Équipe à la date de l'épreuve (5.2), null si Équipe n'est pas activée.
  const equipes = await lirePointsEquipe(ctx, epreuve.entries, epreuve.dateDebut)
  return {
    niveau,
    engagements: epreuve.entries.map((entree, rang) => {
      const points = pointsDePreparation(entree.saisonRegistration?.payeLe != null, entree.saisonReadiness, equipes.get(entree.id) ?? null)
      return {
        id: entree.id,
        voiture: entree.vehicle.nomCourt,
        vehicleId: entree.vehicleId,
        statut: entree.statut,
        points,
        indice: indicePourEngagement(points, maintenant, epreuve.dateDebut),
        surveillance: surveillances[rang],
      }
    }),
  }
}

// --- Tâche 2.4 : reconnaissances de l'épreuve (règles de la reco et sorties) ---------------------

export async function lireReconnaissances(eventId: string) {
  const { ctx, niveau } = await accesSaison("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({
    where: { id: eventId, teamId: ctx.teamId, deletedAt: null },
    select: {
      season: { select: { clotureeAt: true } },
      saisonStages: { where: { deletedAt: null }, select: { id: true, numero: true, nom: true }, orderBy: { numero: "asc" } },
    },
  })
  if (!epreuve) return null

  const recce = await client.saisonRecce.findFirst({
    where: { eventId, teamId: ctx.teamId, deletedAt: null },
    select: {
      id: true,
      debutAutorise: true,
      finAutorisee: true,
      passagesAutorises: true,
      vitesseMax: true,
      vehiculeId: true,
      plaqueRecue: true,
      consignes: true,
      vehicule: { select: { nomCourt: true } },
      sessions: {
        where: { deletedAt: null },
        select: { id: true, date: true, personnes: true, speciales: true, passages: true, notes: true },
        orderBy: [{ date: "asc" }, { id: "asc" }],
      },
    },
  })

  // Les noms ne servent qu'à l'affichage : une seule lecture des personnes et des véhicules de reco.
  const [personnes, vehicules] = await Promise.all([
    client.corePerson.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, prenom: true, nom: true } }),
    client.coreVehicle.findMany({
      where: { teamId: ctx.teamId, type: "reco", actif: true, deletedAt: null },
      select: { id: true, nomCourt: true },
      orderBy: { nomCourt: "asc" },
    }),
  ])
  const nomPersonne = new Map(personnes.map((p) => [p.id, `${p.prenom} ${p.nom}`]))
  const nomSpeciale = new Map(epreuve.saisonStages.map((stage) => [stage.id, `${stage.numero}. ${stage.nom}`]))

  return {
    niveau,
    saisonCloturee: epreuve.season.clotureeAt !== null,
    speciales: epreuve.saisonStages,
    personnes: personnes.map((p) => ({ id: p.id, nom: `${p.prenom} ${p.nom}` })),
    vehicules,
    recce: recce
      ? {
          id: recce.id,
          debutAutorise: recce.debutAutorise,
          finAutorisee: recce.finAutorisee,
          passagesAutorises: recce.passagesAutorises,
          vitesseMax: recce.vitesseMax,
          vehiculeId: recce.vehiculeId,
          vehiculeNom: recce.vehicule?.nomCourt ?? null,
          plaqueRecue: recce.plaqueRecue,
          consignes: recce.consignes,
          sessions: recce.sessions.map((session) => ({
            id: session.id,
            date: session.date,
            personnes: session.personnes.map((id) => nomPersonne.get(id) ?? "Membre"),
            speciales: session.speciales.map((id) => nomSpeciale.get(id) ?? "Spéciale"),
            passages: session.passages,
            notes: session.notes,
          })),
        }
      : null,
  }
}

// Kilomètres chronométrés des résultats validés d'une saison (lecture pour Budget : coût du km). Jamais les
// résultats saisis ou à valider : seuls les validés comptent.
export async function lireKmChronometresValides(saisonId: string): Promise<number> {
  const { ctx } = await accesSaison("lecture")
  const lignes = await prismaPourTeam(ctx.teamId, ctx.userId).saisonResult.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, validation: "valide", entry: { teamId: ctx.teamId, event: { seasonId: saisonId } } },
    select: { kmChronometres: true },
  })
  return Math.round(lignes.reduce((total, ligne) => total + Number(ligne.kmChronometres ?? 0), 0) * 10) / 10
}

// Identifiants des épreuves passées de la saison en cours (20 plus récentes), pour précharger leurs fiches
// hors ligne (brief 2.9, point 8). Vide si le membre n'a pas accès à Saison ou s'il n'y a pas de saison en cours.
export async function lireIdsEpreuvesPasseesSaisonEnCours(): Promise<string[]> {
  let ctx: Awaited<ReturnType<typeof accesSaison>>["ctx"]
  try {
    ;({ ctx } = await accesSaison("lecture"))
  } catch {
    return []
  }
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const saison = await client.coreSeason.findFirst({ where: { teamId: ctx.teamId, deletedAt: null, enCours: true }, select: { id: true } })
  if (!saison) return []
  const aujourdhui = new Date(`${jourDeParis(new Date())}T00:00:00Z`)
  const epreuves = await client.coreEvent.findMany({
    where: { teamId: ctx.teamId, seasonId: saison.id, deletedAt: null, dateFin: { lt: aujourdhui } },
    orderBy: [{ dateDebut: "desc" }],
    take: 20,
    select: { id: true },
  })
  return epreuves.map((epreuve) => epreuve.id)
}
