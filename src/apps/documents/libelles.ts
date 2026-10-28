// Libellés français des écrans de Documents (tâche 5.3). Aucun nom technique à l'écran : le type, la visibilité et la
// zone se lisent en toutes lettres, la couleur n'est qu'un renfort (brief 5.3, §5).

import type { NiveauAcces, TypeDocument, Visibilite, Zone } from "./regles"

export const LIBELLE_TYPE_DOCUMENT: Record<TypeDocument, string> = {
  statuts: "Statuts de l'association",
  recepisse_rna: "Récépissé de déclaration (RNA)",
  pv_ag: "PV d'assemblée générale",
  reglement_ffsa: "Règlement FFSA",
  reglement_particulier: "Règlement particulier",
  modele: "Modèle",
  assurance_asso: "Assurance de l'association",
  attestation: "Attestation",
  autre: "Autre",
}

export const LIBELLE_VISIBILITE: Record<Visibilite, string> = {
  team: "Toute l'équipe",
  gestion: "Gestion seulement",
  prive: "Personnes choisies",
}

export const LIBELLE_NIVEAU_ACCES: Record<NiveauAcces, string> = {
  lecture: "Lecture",
  contribution: "Contribution",
}

export const COULEUR_ZONE: Record<Zone, string> = {
  vert: "text-etat-ok",
  orange: "text-etat-orange",
  rouge: "text-etat-rouge",
}

export function libelleCompteur(nombre: number, singulier: string, pluriel: string): string {
  return `${nombre} ${nombre > 1 ? pluriel : singulier}`
}
