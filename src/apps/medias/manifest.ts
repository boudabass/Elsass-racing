import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Médias. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteMedias: ManifesteApp = {
  cle: "medias",
  nom: "Médias",
  icone: "camera",
  version: "0.1.0",
  requiert: ["saison"],
  menu: [{ libelle: "Accueil", chemin: "/" }],
  widgets: [...WIDGETS.medias],
  evenementsEmis: evenementsEmisPar("medias"),
  evenementsEcoutes: evenementsEcoutesPar("medias"),
}
