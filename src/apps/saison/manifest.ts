import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Saison. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteSaison: ManifesteApp = {
  cle: "saison",
  nom: "Saison",
  icone: "calendar-days",
  version: "0.1.0",
  requiert: [],
  menu: [{ libelle: "Accueil", chemin: "/" }],
  widgets: [...WIDGETS.saison],
  evenementsEmis: evenementsEmisPar("saison"),
  evenementsEcoutes: evenementsEcoutesPar("saison"),
}
