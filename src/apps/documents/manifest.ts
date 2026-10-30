import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Documents (tâche 5.4, brief §4). Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés). Menu : Coffre-fort, Échéances, Tous les fichiers, Partages (hors assistance, 957).
export const manifesteDocuments: ManifesteApp = {
  cle: "documents",
  nom: "Documents",
  icone: "folder",
  version: "0.2.0",
  requiert: [],
  menu: [
    { libelle: "Coffre-fort", chemin: "/" },
    { libelle: "Échéances", chemin: "/echeances" },
    { libelle: "Tous les fichiers", chemin: "/fichiers" },
    { libelle: "Partages", chemin: "/partages", masquePourRoles: ["assistance"] },
  ],
  widgets: [...WIDGETS.documents],
  evenementsEmis: evenementsEmisPar("documents"),
  evenementsEcoutes: evenementsEcoutesPar("documents"),
}
