// Lectures d'Équipe (tâche 5.1, brief §6). Aucune écriture : une lecture ne crée rien, pas même un profil (un profil
// absent se lit comme vide). Les fonctions ne font pas de garde : l'appelant passe le niveau d'accès (accesEquipe).
// Ce qui sort dépend du niveau : le ressenti et le contact d'urgence ne sortent qu'à l'écriture ou plus (équipage,
// responsable), et le contact d'urgence et la taille restent au dossier propre pour l'assistance. Aucune donnée
// médicale (955 §3).

import { lireResultatsValidesEngagements, type ResultatValideEngagement } from "@/apps/saison/lectures-partagees"
import { ludiqueAfficheDansLaTeam } from "@/apps/settings/preferences-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { jourDeParis } from "@/core/dates"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { prismaPourTeam } from "@/lib/prisma"

import {
  LIBELLES_TYPE_LICENCE,
  NOMBRE_RESSENTIS_MOYENNE,
  ressentiMoyen,
  statistiquesBinome,
  statistiquesPersonne,
  statutEquipement,
  statutLicence,
  statutLePlusUrgent,
  type Palier,
  type ReponseDisponibilite,
  type ResultatValide,
  type RoleHabituel,
  type StatutEcheance,
  type StatistiquesBinome,
  type StatistiquesPersonne,
  type TypeEquipement,
  type TypeLicence,
  type Specialite,
} from "./regles"
import { personneDuMembre } from "./services-serveur"


// Membres actifs de la team qui ont une personne liée (l'invité n'a pas accès à Équipe). Une personne par ligne.
export interface MembrePersonne {
  personId: string
  prenom: string
  nom: string
  photoFileId: string | null
}

export async function lireMembres(ctx: ContexteTeam): Promise<MembrePersonne[]> {
  const membres = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findMany({
    where: { teamId: ctx.teamId, statut: "actif", deletedAt: null, role: { not: "invite" }, personId: { not: null } },
    select: { person: { select: { id: true, prenom: true, nom: true, photoFileId: true, deletedAt: true } } },
  })
  const parPersonne = new Map<string, MembrePersonne>()
  for (const membre of membres) {
    const personne = membre.person
    if (!personne || personne.deletedAt) continue
    parPersonne.set(personne.id, { personId: personne.id, prenom: personne.prenom, nom: personne.nom, photoFileId: personne.photoFileId })
  }
  return Array.from(parPersonne.values())
}

// Prochaine épreuve : la première à venir (aujourd'hui compris, jour de Paris), envisagée ou en cours.
export interface EpreuveAVenir {
  eventId: string
  nom: string
  dateDebut: Date
}

export async function prochaineEpreuve(ctx: ContexteTeam): Promise<EpreuveAVenir | null> {
  const debut = new Date(`${jourDeParis(new Date())}T00:00:00Z`)
  const epreuve = await prismaPourTeam(ctx.teamId, ctx.userId).coreEvent.findFirst({
    where: { teamId: ctx.teamId, deletedAt: null, statut: { in: ["envisagee", "en_cours"] }, dateDebut: { gte: debut } },
    orderBy: { dateDebut: "asc" },
    select: { id: true, nom: true, dateDebut: true },
  })
  return epreuve ? { eventId: epreuve.id, nom: epreuve.nom, dateDebut: epreuve.dateDebut } : null
}

// Pastille d'échéance d'une liste de dates de fin : la plus urgente, null sans date.
function pastille(dates: Array<Date | null>, statut: (date: Date | null, maintenant: Date) => StatutEcheance): StatutEcheance | null {
  const maintenant = new Date()
  const suivies = dates.filter((date): date is Date => date !== null)
  return statutLePlusUrgent(suivies.map((date) => statut(date, maintenant)))
}

// Palier affiché : seulement si la personne affiche ses trophées et si le ludique de la team est actif.
function palierAffiche(palier: Palier, afficherTrophees: boolean, ludique: boolean): Palier | null {
  return afficherTrophees && ludique ? palier : null
}

// --- Cartes de l'équipe ---------------------------------------------------------------------

export interface CarteMembre {
  personId: string
  prenom: string
  nom: string
  photoFileId: string | null
  roles: RoleHabituel[]
  palier: Palier | null
  licence: StatutEcheance | null
  equipement: StatutEcheance | null
  // Réponse pour la prochaine épreuve, null sans réponse ou sans épreuve à venir.
  disponibilite: ReponseDisponibilite | null
}

export async function lireCartesEquipe(ctx: ContexteTeam): Promise<CarteMembre[]> {
  const membres = await lireMembres(ctx)
  const personIds = membres.map((membre) => membre.personId)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await prochaineEpreuve(ctx)
  const [profils, licences, equipements, reponses, ludique] = await Promise.all([
    client.equipeProfile.findMany({
      where: { teamId: ctx.teamId, personId: { in: personIds }, deletedAt: null },
      select: { personId: true, rolesHabituels: true, palier: true, afficherTrophees: true },
    }),
    client.equipeLicence.findMany({
      where: { teamId: ctx.teamId, personId: { in: personIds }, deletedAt: null },
      select: { personId: true, valableAu: true },
    }),
    client.equipeGear.findMany({
      where: { teamId: ctx.teamId, personId: { in: personIds }, deletedAt: null },
      select: { personId: true, finHomologation: true },
    }),
    epreuve
      ? client.equipeAvailability.findMany({
          where: { teamId: ctx.teamId, eventId: epreuve.eventId, personId: { in: personIds }, deletedAt: null },
          select: { personId: true, reponse: true },
        })
      : Promise.resolve([]),
    ludiqueAfficheDansLaTeam(ctx),
  ])

  const profilDe = new Map(profils.map((profil) => [profil.personId, profil]))
  const reponseDe = new Map(reponses.map((reponse) => [reponse.personId, reponse.reponse]))

  return membres.map((membre) => {
    const profil = profilDe.get(membre.personId)
    return {
      personId: membre.personId,
      prenom: membre.prenom,
      nom: membre.nom,
      photoFileId: membre.photoFileId,
      roles: profil?.rolesHabituels ?? [],
      palier: profil ? palierAffiche(profil.palier, profil.afficherTrophees, ludique) : null,
      licence: pastille(
        licences.filter((licence) => licence.personId === membre.personId).map((licence) => licence.valableAu),
        statutLicence,
      ),
      equipement: pastille(
        equipements.filter((equipement) => equipement.personId === membre.personId).map((equipement) => equipement.finHomologation),
        statutEquipement,
      ),
      disponibilite: reponseDe.get(membre.personId) ?? null,
    }
  })
}

// --- Présence à la prochaine épreuve -------------------------------------------------------

export interface PresenceEpreuve {
  epreuve: EpreuveAVenir | null
  vient: string[]
  neVientPas: string[]
  peutEtre: string[]
  sansReponse: string[]
}

// Qui vient, qui ne vient pas, qui n'a pas répondu, pour la prochaine épreuve. Noms seulement : rien de privé.
export async function lirePresenceProchaineEpreuve(ctx: ContexteTeam): Promise<PresenceEpreuve> {
  const epreuve = await prochaineEpreuve(ctx)
  const membres = await lireMembres(ctx)
  const nomDe = (membre: MembrePersonne) => `${membre.prenom} ${membre.nom}`
  if (!epreuve) return { epreuve: null, vient: [], neVientPas: [], peutEtre: [], sansReponse: membres.map(nomDe) }

  const reponses = await prismaPourTeam(ctx.teamId, ctx.userId).equipeAvailability.findMany({
    where: { teamId: ctx.teamId, eventId: epreuve.eventId, deletedAt: null },
    select: { personId: true, reponse: true },
  })
  const reponseDe = new Map(reponses.map((reponse) => [reponse.personId, reponse.reponse]))
  const presence: PresenceEpreuve = { epreuve, vient: [], neVientPas: [], peutEtre: [], sansReponse: [] }
  for (const membre of membres) {
    const reponse = reponseDe.get(membre.personId)
    if (reponse === "vient") presence.vient.push(nomDe(membre))
    else if (reponse === "ne_vient_pas") presence.neVientPas.push(nomDe(membre))
    else if (reponse === "peut_etre") presence.peutEtre.push(nomDe(membre))
    else presence.sansReponse.push(nomDe(membre))
  }
  return presence
}

// --- Statistiques officielles ---------------------------------------------------------------

function versResultat(resultat: ResultatValideEngagement): ResultatValide {
  return {
    statutFinal: resultat.statutFinal,
    classementGeneral: resultat.classementGeneral,
    classementClasse: resultat.classementClasse,
    kmSpeciale: resultat.kmSpeciale,
  }
}

// Statistiques d'une personne : épreuves où elle était pilote ou copilote, au résultat validé.
export async function lireStatistiquesPersonne(ctx: ContexteTeam, personId: string): Promise<StatistiquesPersonne> {
  const resultats = await lireResultatsValidesEngagements(ctx, { OR: [{ piloteId: personId }, { copiloteId: personId }] })
  return statistiquesPersonne(resultats.map(versResultat))
}

export interface BinomeEquipe {
  piloteId: string
  copiloteId: string
  stats: StatistiquesBinome
}

// Binômes pilote et copilote : un par couple, sur les engagements où les deux étaient inscrits (résultat validé).
export async function lireBinomes(ctx: ContexteTeam): Promise<BinomeEquipe[]> {
  const resultats = await lireResultatsValidesEngagements(ctx, { piloteId: { not: null }, copiloteId: { not: null } })
  const parCouple = new Map<string, { piloteId: string; copiloteId: string; liste: ResultatValideEngagement[] }>()
  for (const resultat of resultats) {
    if (!resultat.piloteId || !resultat.copiloteId) continue
    const cle = `${resultat.piloteId}|${resultat.copiloteId}`
    const entree = parCouple.get(cle) ?? { piloteId: resultat.piloteId, copiloteId: resultat.copiloteId, liste: [] }
    entree.liste.push(resultat)
    parCouple.set(cle, entree)
  }
  return Array.from(parCouple.values()).map((entree) => ({
    piloteId: entree.piloteId,
    copiloteId: entree.copiloteId,
    stats: statistiquesBinome(entree.liste.map(versResultat)),
  }))
}

// --- Fiche d'une personne -------------------------------------------------------------------

export interface FicheLicence {
  id: string
  type: TypeLicence
  libelle: string
  numero: string | null
  saison: string | null
  valableAu: Date | null
  statut: StatutEcheance | null
  // Montant : visible au niveau écriture ou plus (c'est une dépense de la team).
  montantCents: number | null
}

export interface FicheEquipement {
  id: string
  type: TypeEquipement
  marque: string | null
  modele: string | null
  norme: string | null
  finHomologation: Date | null
  statut: StatutEcheance | null
}

export interface FicheSpecialite {
  id: string
  specialite: Specialite
  niveauDeclare: number | null
  formation: string | null
  dateFormation: Date | null
}

export interface FicheDisponibilite {
  eventId: string
  nom: string
  dateDebut: Date
  reponse: ReponseDisponibilite
  jours: Date[]
}

export interface FichePersonne {
  personId: string
  prenom: string
  nom: string
  // Vrai quand la fiche est celle du membre courant.
  estSoi: boolean
  roles: RoleHabituel[]
  debutSportAuto: Date | null
  palier: Palier | null
  // Contact d'urgence et taille : au niveau écriture ou plus, et au dossier propre.
  tailleVetements: string | null
  contactUrgence: string | null
  licences: FicheLicence[]
  equipements: FicheEquipement[]
  specialites: FicheSpecialite[]
  disponibilites: FicheDisponibilite[]
  statistiques: StatistiquesPersonne
  // Ressenti moyen des derniers débriefs : au niveau écriture ou plus uniquement (privé à l'équipage).
  ressenti: number | null
}

export async function lireFichePersonne(ctx: ContexteTeam, niveau: Niveau, personId: string): Promise<FichePersonne | null> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const personne = await client.corePerson.findFirst({
    where: { id: personId, teamId: ctx.teamId, deletedAt: null },
    select: { prenom: true, nom: true },
  })
  if (!personne) return null

  const estSoi = (await personneDuMembre(ctx)) === personId
  const voitPrive = aAuMoins(niveau, "ecriture")
  const voitContact = voitPrive || estSoi
  const maintenant = new Date()
  const [profil, licences, equipements, specialites, dispos, moods, ludique, statistiques] = await Promise.all([
    client.equipeProfile.findFirst({
      where: { teamId: ctx.teamId, personId, deletedAt: null },
      select: { rolesHabituels: true, debutSportAuto: true, tailleVetements: true, contactUrgence: true, palier: true, afficherTrophees: true },
    }),
    client.equipeLicence.findMany({
      where: { teamId: ctx.teamId, personId, deletedAt: null },
      orderBy: { valableAu: "desc" },
      select: { id: true, type: true, numero: true, saison: true, valableAu: true, montantCents: true },
    }),
    client.equipeGear.findMany({
      where: { teamId: ctx.teamId, personId, deletedAt: null },
      select: { id: true, type: true, marque: true, modele: true, norme: true, finHomologation: true },
    }),
    client.equipeSkill.findMany({
      where: { teamId: ctx.teamId, personId, deletedAt: null },
      select: { id: true, specialite: true, niveauDeclare: true, formation: true, dateFormation: true },
    }),
    client.equipeAvailability.findMany({
      where: { teamId: ctx.teamId, personId, deletedAt: null, event: { dateDebut: { gte: new Date(`${jourDeParis(maintenant)}T00:00:00Z`) } } },
      orderBy: { event: { dateDebut: "asc" } },
      select: { eventId: true, reponse: true, jours: true, event: { select: { nom: true, dateDebut: true } } },
    }),
    voitPrive
      ? client.equipeMood.findMany({
          where: { teamId: ctx.teamId, personId, deletedAt: null },
          orderBy: { saisiLe: "desc" },
          take: NOMBRE_RESSENTIS_MOYENNE,
          select: { ressenti: true },
        })
      : Promise.resolve([]),
    ludiqueAfficheDansLaTeam(ctx),
    lireStatistiquesPersonne(ctx, personId),
  ])

  return {
    personId,
    prenom: personne.prenom,
    nom: personne.nom,
    estSoi,
    roles: profil?.rolesHabituels ?? [],
    debutSportAuto: profil?.debutSportAuto ?? null,
    palier: profil ? palierAffiche(profil.palier, profil.afficherTrophees, ludique) : null,
    tailleVetements: voitContact ? (profil?.tailleVetements ?? null) : null,
    contactUrgence: voitContact ? (profil?.contactUrgence ?? null) : null,
    licences: licences.map((licence) => ({
      id: licence.id,
      type: licence.type,
      libelle: LIBELLES_TYPE_LICENCE[licence.type],
      numero: licence.numero,
      saison: licence.saison,
      valableAu: licence.valableAu,
      statut: licence.valableAu ? statutLicence(licence.valableAu, maintenant) : null,
      montantCents: voitPrive ? licence.montantCents : null,
    })),
    equipements: equipements.map((equipement) => ({
      id: equipement.id,
      type: equipement.type,
      marque: equipement.marque,
      modele: equipement.modele,
      norme: equipement.norme,
      finHomologation: equipement.finHomologation,
      statut: equipement.finHomologation ? statutEquipement(equipement.finHomologation, maintenant) : null,
    })),
    specialites,
    disponibilites: dispos.map((dispo) => ({
      eventId: dispo.eventId,
      nom: dispo.event.nom,
      dateDebut: dispo.event.dateDebut,
      reponse: dispo.reponse,
      jours: dispo.jours,
    })),
    statistiques,
    ressenti: voitPrive ? ressentiMoyen(moods.map((mood) => mood.ressenti)) : null,
  }
}
