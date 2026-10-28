import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Documents (tâche 5.3, brief §4). Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés). Seul le coffre-fort est au menu en 5.3 ; les autres entrées viennent en 5.4.
export const manifesteDocuments: ManifesteApp = {
  cle: "documents",
  nom: "Documents",
  icone: "folder",
  version: "0.2.0",
  requiert: [],
  menu: [{ libelle: "Coffre-fort", chemin: "/" }],
  widgets: [...WIDGETS.documents],
  evenementsEmis: evenementsEmisPar("documents"),
  evenementsEcoutes: evenementsEcoutesPar("documents"),
}
