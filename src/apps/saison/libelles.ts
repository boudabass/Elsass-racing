// Libellés français de toutes les énumérations de Saison : statuts, types, modes de paiement,
// points de préparation. Un seul fichier : l'écran n'affiche jamais une valeur brute.
// Les types TypeScript sont des Record complets (le compilateur refuse une valeur sans libellé) ;
// libelles.test.ts vérifie la même chose pour chaque énumération du schéma Prisma.

import type { CouleurIndice, RoleMembre, StatutEngagement, StatutEpreuve, StatutPoint, StatutResultat, TypeEpreuve, ValidationResultat } from "./regles"

export const LIBELLE_STATUT_ENGAGEMENT: Record<StatutEngagement, string> = {
  envisage: "Envisagé",
  inscrit: "Inscrit",
  paye: "Payé",
  parti: "Parti",
  arrivee: "Arrivé",
  abandon: "Abandon",
  forfait: "Forfait",
}

export const LIBELLE_STATUT_EPREUVE: Record<StatutEpreuve, string> = {
  envisagee: "À venir",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
}

export const LIBELLE_TYPE_EPREUVE: Record<TypeEpreuve, string> = {
  rallye: "Rallye",
  slalom: "Slalom",
  course_de_cote: "Course de côte",
  expo: "Exposition",
  roulage: "Roulage",
  autre: "Autre",
}

export const LIBELLE_STATUT_RESULTAT: Record<StatutResultat, string> = {
  arrivee: "Arrivée",
  abandon: "Abandon",
  exclusion: "Exclusion",
  forfait: "Forfait",
}

export const LIBELLE_VALIDATION_RESULTAT: Record<ValidationResultat, string> = {
  saisi: "Saisi",
  a_verifier: "À vérifier",
  valide: "Validé",
  conteste: "Contesté",
}

export const LIBELLE_ROLE: Record<RoleMembre, string> = {
  responsable: "Responsable",
  equipage: "Équipage",
  assistance: "Assistance",
  invite: "Invité",
}

export const LIBELLE_INDICE: Record<CouleurIndice, string> = {
  vert: "Prêt",
  orange: "À finir",
  rouge: "Urgent",
}

export const LIBELLE_POINT_PREPARATION: Record<SaisonReadinessPoint, string> = {
  paiement: "Paiement",
  licences: "Licences",
  homologations: "Homologations",
  papiers: "Papiers",
  pieces: "Pièces",
}

export const LIBELLE_STATUT_POINT: Record<StatutPoint, string> = {
  regle: "Réglé",
  ouvert: "Ouvert",
}

export const LIBELLE_MODE_PAIEMENT: Record<SaisonPaiementMode, string> = {
  cheque: "Chèque",
  virement: "Virement",
  en_ligne: "Paiement en ligne",
}

export const LIBELLE_TYPE_ETAPE: Record<SaisonStageType, string> = {
  speciale: "Spéciale",
  manche_slalom: "Manche de slalom",
  montee: "Montée",
}

export const LIBELLE_TYPE_PROGRAMME: Record<SaisonScheduleType, string> = {
  verif_administratives: "Vérifications administratives",
  verif_techniques: "Vérifications techniques",
  shakedown: "Shakedown",
  depart: "Départ",
  passage_speciale: "Passage de spéciale",
  regroupement: "Regroupement",
  assistance: "Assistance",
  arrivee: "Arrivée",
  remise_des_prix: "Remise des prix",
}

export const LIBELLE_TYPE_DOCUMENT: Record<SaisonGeneratedDocType, string> = {
  bulletin_engagement: "Bulletin d'engagement",
  demande_assistance: "Demande d'assistance",
  declaration_vehicule_reco: "Déclaration de véhicule de reconnaissance",
  autorisation_proprietaire: "Autorisation du propriétaire",
}

// Types du schéma Prisma, repris ici pour que le compilateur les vérifie.
type SaisonReadinessPoint = "paiement" | "licences" | "homologations" | "papiers" | "pieces"
type SaisonPaiementMode = "cheque" | "virement" | "en_ligne"
type SaisonStageType = "speciale" | "manche_slalom" | "montee"
type SaisonScheduleType =
  | "verif_administratives"
  | "verif_techniques"
  | "shakedown"
  | "depart"
  | "passage_speciale"
  | "regroupement"
  | "assistance"
  | "arrivee"
  | "remise_des_prix"
type SaisonGeneratedDocType = "bulletin_engagement" | "demande_assistance" | "declaration_vehicule_reco" | "autorisation_proprietaire"

// Libellé d'une valeur quelconque : la valeur brute si elle n'est pas connue (ne devrait jamais arriver).
export function libelle(table: Record<string, string>, valeur: string): string {
  return table[valeur] ?? valeur
}
