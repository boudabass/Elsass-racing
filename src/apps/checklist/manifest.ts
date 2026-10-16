import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Check-lists. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteChecklist: ManifesteApp = {
  cle: "checklist",
  nom: "Check-lists",
  icone: "list-checks",
  version: "0.1.0",
  requiert: ["saison"],
  menu: [{ libelle: "Accueil", chemin: "/" }],
  widgets: [...WIDGETS.checklist],
  evenementsEmis: evenementsEmisPar("checklist"),
  evenementsEcoutes: evenementsEcoutesPar("checklist"),
}
