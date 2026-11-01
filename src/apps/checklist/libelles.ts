// Libellés à l'écran de Check-lists (tâche 5.6). Vocabulaire du rallye, pas de jargon : une seule source.
import type { Phase, RoleSuggere } from "./services-serveur"
import type { StatutPoint, Zone } from "./regles"

export const LIBELLES_PHASE: Record<Phase, string> = {
  avant_depart: "Avant départ",
  verifications: "Vérifications",
  reconnaissances: "Reconnaissances",
  epreuve: "Épreuve",
  retour: "Retour",
}

export const LIBELLES_STATUT_POINT: Record<StatutPoint, string> = {
  a_faire: "À faire",
  fait: "Fait",
  sans_objet: "Sans objet",
  probleme: "Problème",
}

export const LIBELLES_ZONE: Record<Zone, string> = {
  vert: "À jour",
  orange: "À compléter",
}

// Couleur de la zone : vert ou orange seulement, jamais de rouge. Le texte porte l'information, la couleur la renforce.
export const COULEUR_ZONE: Record<Zone, string> = {
  vert: "text-etat-ok",
  orange: "text-etat-orange",
}

export const LIBELLES_ROLE_SUGGERE: Record<RoleSuggere, string> = {
  equipage: "Équipage",
  assistance: "Assistance",
}

export const LIBELLES_LIEN: Record<string, string> = {
  aucun: "Aucun",
  organe_garage: "Organe de Garage",
  train_pneus: "Train de pneus",
  papier_voiture: "Papier de Voiture",
  logo_voiture: "Logo de Voiture",
  licence_equipe: "Licence d'Équipe",
  homologation_equipe: "Homologation d'Équipe",
  contrepartie_partenaires: "Contrepartie de Partenaires",
  document_documents: "Document de Documents",
}

// Ordre des phases (956 §1), du départ au retour.
export const PHASES_ORDONNEES: readonly Phase[] = ["avant_depart", "verifications", "reconnaissances", "epreuve", "retour"]
