import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Documents. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteDocuments: ManifesteApp = {
  cle: "documents",
  nom: "Documents",
  icone: "folder",
  version: "0.1.0",
  requiert: [],
  menu: [{ libelle: "Accueil", chemin: "/" }],
  widgets: [...WIDGETS.documents],
  evenementsEmis: evenementsEmisPar("documents"),
  evenementsEcoutes: evenementsEcoutesPar("documents"),
}
