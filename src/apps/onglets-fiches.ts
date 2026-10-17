// Onglets que les apps apportent aux fiches des autres apps (tâche 2.8, point 7). Ce fichier connaît les apps,
// pas le socle ni la fiche : la fiche épreuve de Saison lit cette liste et rend `onglet.composant`, sans
// importer Budget. Contrat : src/core/sdk/onglets.ts ; docs/app-sdk.md, section « Onglets de fiche ».

import type { OngletApp } from "@/core/sdk/onglets"
import { PanneauDepensesEpreuve } from "@/apps/budget/composants/depenses-epreuve"

export const ONGLETS_FICHE_EPREUVE: readonly OngletApp[] = [
  { cle: "depenses", libelle: "Dépenses", app: "budget", niveauMinimum: "contribution", composant: PanneauDepensesEpreuve },
]
