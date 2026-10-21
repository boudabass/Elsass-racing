// Libellés des tables synchronisées, pour afficher un envoi refusé dans le vocabulaire de l'app (règle 8). Chaque table
// de TABLES_LOCALES a un libellé ; un test de couverture (refus.test.ts) échoue si une table déclarée au registre
// serveur n'en a pas.
//
// Le résumé (resumer) ne devine rien : il ne lit que les champs qui sont vraiment saisis. Sans résumé, l'écran montre
// le libellé de la table et la date de la saisie.

import type { TableLocale } from "./base"

export interface LibelleTable {
  libelle: string
  // Texte saisi qui nomme la ligne, ou null si le champ est absent ou vide.
  resumer?: (champs: Record<string, unknown>) => string | null
}

// Texte court d'un champ saisi : absent ou vide donne null, un texte trop long est coupé.
function texteDe(valeur: unknown, longueur = 80): string | null {
  if (typeof valeur !== "string") return null
  const propre = valeur.trim()
  if (propre === "") return null
  return propre.length > longueur ? `${propre.slice(0, longueur - 1)}…` : propre
}

export const LIBELLES_TABLES: Record<TableLocale, LibelleTable> = {
  core_note: { libelle: "Note", resumer: (champs) => texteDe(champs.texte) },
  core_event: { libelle: "Épreuve" },
  saison_stage: { libelle: "Préparation" },
  saison_schedule_item: { libelle: "Programme" },
  saison_recce: { libelle: "Reconnaissance" },
  saison_recce_session: { libelle: "Sortie de reconnaissance" },
  saison_debrief: { libelle: "Débrief" },
  budget_expense: { libelle: "Dépense", resumer: (champs) => texteDe(champs.libelle) },
  budget_category: { libelle: "Catégorie du budget" },
  budget_payer: { libelle: "Payeur" },
  voiture_setup: { libelle: "Fiche de réglage" },
  core_vehicle: { libelle: "Véhicule" },
  voiture_setup_template: { libelle: "Modèle de réglage" },
  garage_work_order: { libelle: "Intervention", resumer: (champs) => texteDe(champs.titre) },
  garage_vehicle_component: { libelle: "Organe" },
  garage_component_type: { libelle: "Type d'organe" },
}
