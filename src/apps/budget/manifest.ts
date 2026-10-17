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
    { libelle: "À confirmer", chemin: "/a-confirmer", niveauMinimum: "ecriture" },
    { libelle: "Par épreuve", chemin: "/epreuves" },
    { libelle: "Par membre", chemin: "/membres" },
    // L'assistance (contribution) ne voit pas le prévu : même règle que la page.
    { libelle: "Prévisionnel", chemin: "/previsionnel", masquePour: ["contribution"] },
    { libelle: "Recette", chemin: "/recette", niveauMinimum: "ecriture" },
  ],
  widgets: [...WIDGETS.budget],
  evenementsEmis: evenementsEmisPar("budget"),
  evenementsEcoutes: evenementsEcoutesPar("budget"),
}
