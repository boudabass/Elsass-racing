// Libellés de l'écran Équipe, en vocabulaire du rallye (955 et 953). Une seule source : les écrans et les cartes les
// lisent ici, jamais un code brut.

import { COULEUR_STATUT_PAPIER, LIBELLE_STATUT_PAPIER } from "@/apps/voiture/libelles"
import type { StatutPapier } from "@/apps/voiture/regles"

import type { InteretVivier, Palier, ReponseDisponibilite, RoleHabituel } from "./regles"

export const LIBELLE_ROLE_HABITUEL: Record<RoleHabituel, string> = {
  pilote: "Pilote",
  copilote: "Copilote",
  assistance: "Assistance",
  benevole: "Bénévole",
}

export const LIBELLE_PALIER: Record<Palier, string> = {
  rookie: "Rookie",
  confirme: "Confirmé",
  experimente: "Expérimenté",
  veteran: "Vétéran",
  figure: "Figure",
}

export const LIBELLE_REPONSE: Record<ReponseDisponibilite, string> = {
  vient: "Vient",
  ne_vient_pas: "Ne vient pas",
  peut_etre: "Peut-être",
}

// Licence et équipement : le mot et la couleur ensemble, jamais la couleur seule (CLAUDE.md, accessibilité).
export { COULEUR_STATUT_PAPIER as COULEUR_ECHEANCE, LIBELLE_STATUT_PAPIER as LIBELLE_ECHEANCE }

// Pastille d'échéance d'une carte : « Licence : valide » ou « Équipement : à compléter » sans licence saisie.
export function libelleEcheanceCarte(libelle: string, statut: StatutPapier | null): string {
  if (statut === null) return `${libelle} : à compléter`
  return `${libelle} : ${LIBELLE_STATUT_PAPIER[statut].toLowerCase()}`
}

export const LIBELLE_INTERET: Record<InteretVivier, string> = {
  faible: "Faible",
  moyen: "Moyen",
  fort: "Fort",
}
