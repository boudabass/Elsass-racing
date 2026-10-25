// Préparation pour l'épreuve : les points de préparation d'un engagement et son indice. Règles pures.
// Un point « pas encore suivi » n'existe pas encore (son app n'est pas construite, ou elle n'est pas activée) :
// il n'entre pas dans l'indice et ne bloque rien. Le paiement se lit sur l'inscription. Les licences et les
// homologations se lisent chez Équipe, à la date de l'épreuve (lecture partagée, 5.2) : elles sont suivies
// quand Équipe est activée. Les autres points viennent de saison_readiness, alimentée par les événements.
// Les pièces en zone rouge ne sont pas un point (954 v1.4, décision de John du 24/10) : Saison les lit chez
// Garage, en point à surveiller, hors de l'indice.

import { homologationValideA, jourCivil, LIBELLES_TYPE_EQUIPEMENT, licenceValideA } from "@/apps/equipe/regles"
import type { SituationPersonne } from "@/apps/equipe/lectures-partagees"

import { indicePreparation, type IndicePreparation, type StatutPoint } from "./regles"

export const POINTS_PREPARATION = ["paiement", "licences", "homologations", "papiers"] as const
export type PointPreparation = (typeof POINTS_PREPARATION)[number]
export type EtatPoint = StatutPoint | "non_suivi"

// Une ligne de saison_readiness. Les lignes « pieces » posées avant 4.5 restent en base : elles ne sont pas un point,
// donc elles sont ignorées par pointsDePreparation. Les lignes licences et homologations, posées par signal avant
// la 5.2, sont ignorées aussi : Équipe fait foi.
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
}

// Les quatre points, dans l'ordre d'affichage. Le paiement existe toujours ; licences et homologations sont suivis
// quand Équipe est activée (equipe, null sinon) ; les autres quand une ligne existe.
export function pointsDePreparation(
  paiementRegle: boolean,
  lignes: readonly LigneReadiness[],
  equipe: PointsEquipe | null = null,
): PointEtabli[] {
  return POINTS_PREPARATION.map((point) => {
    if (point === "paiement") {
      return { point, etat: paiementRegle ? "regle" : "ouvert", detail: paiementRegle ? null : "Engagement non payé", personneId: null }
    }
    if (point === "licences" || point === "homologations") {
      if (!equipe) return { point, etat: "non_suivi", detail: null, personneId: null }
      const etabli = equipe[point]
      return { point, etat: etabli.etat, detail: etabli.detail, personneId: etabli.personneId }
    }
    const ligne = lignes.find((candidate) => candidate.point === point)
    if (!ligne) return { point, etat: "non_suivi", detail: null, personneId: null }
    return { point, etat: ligne.statut, detail: ligne.detail, personneId: null }
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

// Où régler un point ouvert, en un geste. Le paiement mène à la fiche engagement ; licences et homologations à la
// fiche de la personne concernée dans Équipe, sur son onglet ; les autres, rien tant que leur app n'existe pas.
export type LieuDeReglage =
  | { type: "fiche_engagement" }
  | { type: "fiche_personne"; personneId: string; onglet: "licences" | "equipement" }

export function lieuDeReglage(point: PointEtabli): LieuDeReglage | null {
  if (point.point === "paiement") return { type: "fiche_engagement" }
  if (point.personneId === null) return null
  if (point.point === "licences") return { type: "fiche_personne", personneId: point.personneId, onglet: "licences" }
  if (point.point === "homologations") return { type: "fiche_personne", personneId: point.personneId, onglet: "equipement" }
  return null
}
