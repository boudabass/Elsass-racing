import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Budget. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteBudget: ManifesteApp = {
  cle: "budget",
  nom: "Budget",
  icone: "euro",
  version: "0.1.0",
  requiert: [],
  menu: [
    { libelle: "Mouvements", chemin: "/" },
    { libelle: "À confirmer", chemin: "/a-confirmer" },
    { libelle: "Par épreuve", chemin: "/epreuves" },
    { libelle: "Par membre", chemin: "/membres" },
    { libelle: "Prévisionnel", chemin: "/previsionnel" },
    { libelle: "Recette", chemin: "/recette" },
  ],
  widgets: [...WIDGETS.budget],
  evenementsEmis: evenementsEmisPar("budget"),
  evenementsEcoutes: evenementsEcoutesPar("budget"),
}
