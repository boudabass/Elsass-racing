// Préparation pour l'épreuve : les points de préparation d'un engagement et son indice. Règles pures.
// Un point « pas encore suivi » n'existe pas encore (son app n'est pas construite, ou elle n'est pas activée) :
// il n'entre pas dans l'indice et ne bloque rien. Le paiement se lit sur l'inscription. Les licences et les
// homologations se lisent chez Équipe, à la date de l'épreuve (lecture partagée, 5.2) : elles sont suivies
// quand Équipe est activée. Les papiers du véhicule se lisent chez Voiture, à la même date (5.2b) : suivis quand
// Voiture est activée. Les autres points viennent de saison_readiness, alimentée par les événements.
// Les pièces en zone rouge ne sont pas un point (954 v1.4, décision de John du 24/10) : Saison les lit chez
// Garage, en point à surveiller, hors de l'indice.

import { homologationValideA, jourCivil, LIBELLES_TYPE_EQUIPEMENT, licenceValideA } from "@/apps/equipe/regles"
import type { SituationPersonne } from "@/apps/equipe/lectures-partagees"
import type { PapierSituation } from "@/apps/voiture/lectures-partagees"
import { libelleDuPapier } from "@/apps/voiture/libelles"
import { statutPapier } from "@/apps/voiture/regles"

import { indicePreparation, type IndicePreparation, type StatutPoint } from "./regles"

export const POINTS_PREPARATION = ["paiement", "licences", "homologations", "papiers"] as const
export type PointPreparation = (typeof POINTS_PREPARATION)[number]
export type EtatPoint = StatutPoint | "non_suivi"

// Une ligne de saison_readiness. Les lignes « pieces » posées avant 4.5 restent en base : elles ne sont pas un point,
// donc elles sont ignorées par pointsDePreparation. Les lignes licences et homologations, posées par signal avant
// la 5.2, sont ignorées aussi : Équipe fait foi. Les lignes « papiers » (signal de Voiture, avant 5.2b) aussi : Voiture fait foi.
export interface LigneReadiness {
  point: string
  statut: StatutPoint
  detail: string | null
}

// Ce qu'Équipe dit d'un point, pour un engagement : l'état, le détail affiché, et la personne à régler (fiche Équipe).
export interface PointEquipe {
  etat: StatutPoint
  detail: string | null
  personneId: string | null
}

export interface PointsEquipe {
  licences: PointEquipe
  homologations: PointEquipe
}

export interface PointEtabli {
  point: PointPreparation
  etat: EtatPoint
  detail: string | null
  personneId: string | null
  // Le véhicule à régler (point Papiers), null pour les autres points.
  vehicleId: string | null
}

// Ce que Voiture dit des papiers d'un véhicule, à la date de l'épreuve.
export interface PointVoiture {
  etat: StatutPoint
  detail: string | null
  vehicleId: string
}

// Les quatre points, dans l'ordre d'affichage. Le paiement existe toujours ; licences et homologations sont suivis
// quand Équipe est activée (equipe, null sinon) ; les papiers quand Voiture l'est (voiture, null sinon) ; les autres
// quand une ligne existe.
export function pointsDePreparation(
  paiementRegle: boolean,
  lignes: readonly LigneReadiness[],
  equipe: PointsEquipe | null = null,
  voiture: PointVoiture | null = null,
): PointEtabli[] {
  return POINTS_PREPARATION.map((point) => {
    if (point === "paiement") {
      return { point, etat: paiementRegle ? "regle" : "ouvert", detail: paiementRegle ? null : "Engagement non payé", personneId: null, vehicleId: null }
    }
    if (point === "licences" || point === "homologations") {
      if (!equipe) return { point, etat: "non_suivi", detail: null, personneId: null, vehicleId: null }
      const etabli = equipe[point]
      return { point, etat: etabli.etat, detail: etabli.detail, personneId: etabli.personneId, vehicleId: null }
    }
    if (point === "papiers") {
      if (!voiture) return { point, etat: "non_suivi", detail: null, personneId: null, vehicleId: null }
      return { point, etat: voiture.etat, detail: voiture.detail, personneId: null, vehicleId: voiture.vehicleId }
    }
    const ligne = lignes.find((candidate) => candidate.point === point)
    if (!ligne) return { point, etat: "non_suivi", detail: null, personneId: null, vehicleId: null }
    return { point, etat: ligne.statut, detail: ligne.detail, personneId: null, vehicleId: null }
  })
}

// Indice de l'engagement : réglés ÷ points suivis. Aucun point suivi : pas d'indice.
export function indicePourEngagement(points: readonly PointEtabli[], maintenant: Date, debutEpreuve: Date): IndicePreparation | null {
  const suivis = points.filter((point): point is PointEtabli & { etat: StatutPoint } => point.etat !== "non_suivi")
  return indicePreparation(
    suivis.map((point) => ({ statut: point.etat })),
    maintenant,
    debutEpreuve,
  )
}

// ─── Licences et homologations, à la date de l'épreuve ─────────────────────────────────────

// Date de fin en français, sans l'année : « 3 novembre ».
function jourCourt(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(date)
}

// Ce qui manque à une personne pour sa licence le jour de l'épreuve. Null si une licence est valable.
function manqueLicence(personne: SituationPersonne, jour: Date): string | null {
  const { prenom, licences } = personne
  if (licences.length === 0) return `Licence de ${prenom} non renseignée`
  if (licences.some((licence) => licenceValideA(licence.valableDu, licence.valableAu, jour))) return null

  const expirees = licences.filter((licence) => licence.valableAu !== null && jourCivil(licence.valableAu) < jourCivil(jour))
  if (expirees.length > 0) {
    // La plus tardive des fins passées : c'est celle qui a fait défaut.
    const fin = expirees.reduce((max, licence) => (licence.valableAu!.getTime() > max.getTime() ? licence.valableAu! : max), expirees[0].valableAu!)
    return `Licence de ${prenom} expire le ${jourCourt(fin)}`
  }
  return `Licence de ${prenom} pas encore valable à l'épreuve`
}

// Ce qui manque à une personne pour ses équipements homologués le jour de l'épreuve. Null si tout est en ordre.
// Un équipement sans fin d'homologation n'est pas suivi ici ; il faut au moins un équipement homologué.
function manqueHomologation(personne: SituationPersonne, jour: Date): string | null {
  const homologues = personne.equipements.filter((equipement) => equipement.finHomologation !== null)
  if (homologues.length === 0) return `Équipement homologué de ${personne.prenom} non renseigné`
  const perimes = homologues.filter((equipement) => !homologationValideA(equipement.finHomologation, jour))
  if (perimes.length === 0) return null
  const premier = perimes[0]
  return `${LIBELLES_TYPE_EQUIPEMENT[premier.type]} de ${personne.prenom} : homologation expire le ${jourCourt(premier.finHomologation!)}`
}

// Un point réglé s'il n'y a rien à signaler ; sinon ouvert, avec tous les manques et la première personne concernée.
function bilan(manques: Array<{ personneId: string | null; detail: string }>): PointEquipe {
  if (manques.length === 0) return { etat: "regle", detail: null, personneId: null }
  return { etat: "ouvert", detail: manques.map((manque) => manque.detail).join(" ; "), personneId: manques[0].personneId }
}

// Pilote et copilote de l'engagement, lus chez Équipe à la date de l'épreuve. Le pilote est requis ; le copilote
// n'est vérifié que s'il est désigné.
export function pointsEquipeDeEngagement(
  equipage: { pilote: SituationPersonne | null; copilote: SituationPersonne | null },
  jour: Date,
): PointsEquipe {
  const { pilote, copilote } = equipage
  const personnes = [pilote, copilote].filter((personne): personne is SituationPersonne => personne !== null)

  const licences: Array<{ personneId: string | null; detail: string }> = []
  const homologations: Array<{ personneId: string | null; detail: string }> = []
  if (!pilote) {
    licences.push({ personneId: null, detail: "Pilote non désigné" })
    homologations.push({ personneId: null, detail: "Pilote non désigné" })
  }
  for (const personne of personnes) {
    const licence = manqueLicence(personne, jour)
    if (licence) licences.push({ personneId: personne.personId, detail: licence })
    const homologation = manqueHomologation(personne, jour)
    if (homologation) homologations.push({ personneId: personne.personId, detail: homologation })
  }
  return { licences: bilan(licences), homologations: bilan(homologations) }
}

// Un libellé de papier dans une phrase : « Carte grise » devient « carte grise », un sigle (« RC Pro ») garde sa casse.
function libelleDansPhrase(libelle: string): string {
  const premiere = libelle.charAt(0)
  const seconde = libelle.charAt(1)
  const initialeMajuscule = premiere !== premiere.toLowerCase() && seconde === seconde.toLowerCase() && seconde !== seconde.toUpperCase()
  return initialeMajuscule ? premiere.toLowerCase() + libelle.slice(1) : libelle
}

// Papiers du véhicule, à la date de l'épreuve (5.2b). Un type de papier est réglé s'il a au moins un papier qui n'est
// pas expiré ce jour-là, selon statutPapier de Voiture (importée, jamais recopiée). Un papier sans échéance ne bloque
// jamais ; un renouvellement (nouvelle ligne valable du même type) ferme le point ; « à renouveler » sans être
// expiré ne bloque pas. Aucun papier saisi : ouvert.
// Le détail nomme le véhicule en tête, une fois, sans article (« Saxo : carte grise expire le 3 novembre ») : même
// forme que les homologations. Sans nom connu, le détail reste sans préfixe.
export function pointPapiersDeVehicule(
  vehicleId: string,
  nomCourt: string | null,
  papiers: readonly PapierSituation[],
  jour: Date,
): PointVoiture {
  const prefixe = nomCourt ? `${nomCourt} : ` : ""
  if (papiers.length === 0) {
    return { etat: "ouvert", detail: nomCourt ? `${prefixe}papiers non renseignés` : "Papiers du véhicule non renseignés", vehicleId }
  }

  // Un type se regroupe à part, sauf « Autre » : chaque libellé saisi est un papier distinct.
  const parPapier = new Map<string, PapierSituation[]>()
  for (const papier of papiers) {
    const cle = papier.type === "autre" ? `autre:${papier.libelle ?? ""}` : papier.type
    parPapier.set(cle, [...(parPapier.get(cle) ?? []), papier])
  }

  const manques: string[] = []
  for (const groupe of Array.from(parPapier.values())) {
    if (groupe.some((papier) => statutPapier(papier.valableJusquAu, jour) !== "expire")) continue
    // Tous expirés, donc tous datés : la fin la plus tardive est celle qui a fait défaut.
    const derniere = groupe.reduce((max, papier) => (papier.valableJusquAu!.getTime() > max.valableJusquAu!.getTime() ? papier : max))
    manques.push(`${libelleDansPhrase(libelleDuPapier(derniere.type, derniere.libelle))} expire le ${jourCourt(derniere.valableJusquAu!)}`)
  }
  if (manques.length === 0) return { etat: "regle", detail: null, vehicleId }
  return { etat: "ouvert", detail: `${prefixe}${manques.join(" ; ")}`, vehicleId }
}

// Où régler un point ouvert, en un geste. Le paiement mène à la fiche engagement ; licences et homologations à la
// fiche de la personne concernée dans Équipe, sur son onglet ; les papiers à l'onglet Papiers de la fiche véhicule
// dans Voiture ; les autres, rien tant que leur app n'existe pas.
export type LieuDeReglage =
  | { type: "fiche_engagement" }
  | { type: "fiche_personne"; personneId: string; onglet: "licences" | "equipement" }
  | { type: "fiche_vehicule"; vehicleId: string; onglet: "papiers" }

export function lieuDeReglage(point: PointEtabli): LieuDeReglage | null {
  if (point.point === "paiement") return { type: "fiche_engagement" }
  if (point.point === "papiers") return point.vehicleId ? { type: "fiche_vehicule", vehicleId: point.vehicleId, onglet: "papiers" } : null
  if (point.personneId === null) return null
  if (point.point === "licences") return { type: "fiche_personne", personneId: point.personneId, onglet: "licences" }
  if (point.point === "homologations") return { type: "fiche_personne", personneId: point.personneId, onglet: "equipement" }
  return null
}
