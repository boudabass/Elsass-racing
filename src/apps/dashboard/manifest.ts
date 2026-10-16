import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Tableau de bord. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteDashboard: ManifesteApp = {
  cle: "dashboard",
  nom: "Tableau de bord",
  icone: "layout-dashboard",
  version: "0.1.0",
  requiert: [],
  menu: [{ libelle: "Accueil", chemin: "/" }],
  widgets: [...WIDGETS.dashboard],
  evenementsEmis: evenementsEmisPar("dashboard"),
  evenementsEcoutes: evenementsEcoutesPar("dashboard"),
}
