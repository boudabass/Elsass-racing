// Libellés du Garage à l'écran (tâches 4.2 et suivantes). Vocabulaire du rallye, sans terme technique. Les clés sont celles
// de la base et des services : un libellé manquant est une erreur de typage, pas un texte vide.

import type { ModeUsure } from "./regles"

export const LIBELLE_MODE_USURE: Record<ModeUsure, string> = {
  km: "Kilomètres",
  epreuves: "Épreuves",
  les_deux: "Kilomètres et épreuves",
}

export const LIBELLE_MOTIF_DEPOSE = {
  usure: "Usure",
  casse: "Casse",
  preventif: "Préventif",
  revision: "Révision",
} as const satisfies Record<string, string>

export type MotifDepose = keyof typeof LIBELLE_MOTIF_DEPOSE

export const LIBELLE_QUALITE = {
  origine: "Origine",
  renforcee: "Renforcée",
  competition: "Compétition",
} as const satisfies Record<string, string>

// Ce que devient l'ancienne pièce quand on la remplace (954 v1.2, §2). Le statut suit : voir statutDeDestination.
export const LIBELLE_DESTINATION_ANCIENNE = {
  reserve: "En réserve (en stock)",
  rebut: "Au rebut (cassée)",
  vendue: "Vendue",
} as const satisfies Record<string, string>

export const LIBELLE_STATUT_PIECE = {
  en_stock: "En stock",
  montee: "Montée",
  en_revision: "En révision",
  usee: "Usée",
  cassee: "Cassée",
  vendue: "Vendue",
} as const satisfies Record<string, string>

export const LIBELLE_SOURCE_USURE = {
  resultat_saison: "Résultat de saison",
  saisie_manuelle: "Saisie manuelle",
} as const satisfies Record<string, string>
