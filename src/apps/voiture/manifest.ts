import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Voiture. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteVoiture: ManifesteApp = {
  cle: "voiture",
  nom: "Voiture",
  icone: "car",
  version: "0.1.0",
  requiert: [],
  menu: [{ libelle: "Accueil", chemin: "/" }],
  widgets: [...WIDGETS.voiture],
  evenementsEmis: evenementsEmisPar("voiture"),
  evenementsEcoutes: evenementsEcoutesPar("voiture"),
}
