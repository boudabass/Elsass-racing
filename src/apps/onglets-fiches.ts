// Onglets que les apps apportent aux fiches des autres apps (tâche 2.8, point 7). Ce fichier connaît les apps,
// pas le socle ni la fiche : la fiche épreuve de Saison lit cette liste et rend `onglet.composant`, sans
// importer Budget. Contrat : src/core/sdk/onglets.ts ; docs/app-sdk.md, section « Onglets de fiche ».

import type { OngletApp } from "@/core/sdk/onglets"
import { PanneauDepensesEpreuve } from "@/apps/budget/composants/depenses-epreuve"
import { PanneauDeco } from "@/apps/voiture/composants/deco"
import { PanneauHistorique } from "@/apps/voiture/composants/historique"
import { PanneauIdentite } from "@/apps/voiture/composants/identite"
import { PanneauPapiers } from "@/apps/voiture/composants/papiers"
import { PanneauReglages } from "@/apps/voiture/composants/reglages"

export const ONGLETS_FICHE_EPREUVE: readonly OngletApp[] = [
  { cle: "depenses", libelle: "Dépenses", app: "budget", niveauMinimum: "contribution", composant: PanneauDepensesEpreuve },
]

// Onglets de la fiche véhicule (Voiture, brief 3.3, section 4), dans cet ordre. Garage y ajoutera « État » au
// lot 4 : une entrée de plus ici, et un composant dans Garage. La fiche n'appelle que `composant`.
export const ONGLETS_FICHE_VEHICULE: readonly OngletApp[] = [
  { cle: "identite", libelle: "Identité", app: "voiture", niveauMinimum: "lecture", composant: PanneauIdentite },
  { cle: "papiers", libelle: "Papiers", app: "voiture", niveauMinimum: "lecture", composant: PanneauPapiers },
  { cle: "deco", libelle: "Déco", app: "voiture", niveauMinimum: "lecture", composant: PanneauDeco },
  { cle: "reglages", libelle: "Réglages", app: "voiture", niveauMinimum: "lecture", composant: PanneauReglages },
  { cle: "historique", libelle: "Historique", app: "voiture", niveauMinimum: "lecture", composant: PanneauHistorique },
]
