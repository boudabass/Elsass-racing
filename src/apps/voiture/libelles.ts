// Libellés français et couleurs des écrans de Voiture. Chaque état se lit en toutes lettres : la couleur
// n'est qu'un renfort (brief 3.3, section 2).

import type { EtatPapiersVehicule, StatutEmplacement, StatutPapier } from "./regles"

export type TypeVehicule = "course" | "reco" | "assistance" | "remorque"
export type TypePapier = "passeport_technique" | "fiche_homologation" | "carte_grise" | "assurance" | "controle_technique" | "autre"

export const LIBELLE_TYPE_VEHICULE: Record<TypeVehicule, string> = {
  course: "Course",
  reco: "Reco",
  assistance: "Assistance",
  remorque: "Remorque",
}

export const LIBELLE_TYPE_PAPIER: Record<TypePapier, string> = {
  passeport_technique: "Passeport technique",
  fiche_homologation: "Fiche d'homologation",
  carte_grise: "Carte grise",
  assurance: "Assurance",
  controle_technique: "Contrôle technique",
  autre: "Autre",
}

// Libellé d'un papier : celui saisi pour « Autre », sinon le type.
export function libelleDuPapier(type: TypePapier, libelle: string | null): string {
  return type === "autre" && libelle ? libelle : LIBELLE_TYPE_PAPIER[type]
}

// Statut d'une ligne de papier (onglet Papiers).
export const LIBELLE_STATUT_PAPIER: Record<StatutPapier, string> = {
  valide: "Valide",
  a_renouveler: "À renouveler",
  expire: "Expiré",
}

export const COULEUR_STATUT_PAPIER: Record<StatutPapier, string> = {
  valide: "text-etat-ok",
  a_renouveler: "text-etat-orange",
  expire: "text-etat-rouge",
}

// État des papiers d'un véhicule (carte et en-tête de la fiche).
export const LIBELLE_ETAT_PAPIERS: Record<EtatPapiersVehicule, string> = {
  valide: "Papiers à jour",
  a_renouveler: "Papier à renouveler",
  expire: "Papier expiré",
  aucun: "Aucun papier",
}

export const COULEUR_ETAT_PAPIERS: Record<EtatPapiersVehicule, string> = {
  valide: "text-etat-ok",
  a_renouveler: "text-etat-orange",
  expire: "text-etat-rouge",
  aucun: "text-texte-discret",
}

// Statut d'un emplacement (onglet Déco).
export const LIBELLE_STATUT_EMPLACEMENT: Record<StatutEmplacement, string> = {
  libre: "Libre",
  reserve: "Réservé",
  occupe: "Occupé",
  indisponible: "Indisponible",
}

export const COULEUR_STATUT_EMPLACEMENT: Record<StatutEmplacement, string> = {
  libre: "text-etat-ok",
  reserve: "text-etat-orange",
  occupe: "text-texte",
  indisponible: "text-texte-discret",
}

// Date civile (@db.Date lue en UTC à minuit) : « 3 novembre 2026 ».
const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export function dateEnToutesLettres(date: Date): string {
  return formatJour.format(date)
}

// Groupe et classe sur une ligne : « N2 · classe 11 », ou ce qui est renseigné.
export function groupeEtClasse(groupe: string | null, classe: string | null): string | null {
  if (groupe && classe) return `${groupe} · classe ${classe}`
  if (groupe) return groupe
  if (classe) return `classe ${classe}`
  return null
}
