import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Check-lists. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteChecklist: ManifesteApp = {
  cle: "checklist",
  nom: "Check-lists",
  icone: "list-checks",
  version: "0.3.0",
  requiert: ["saison"],
  // Préparation pour tous ; Modèles sans l'assistance (956 §6) ; Débrief à partir de l'écriture (5.6, décision du 01/11).
  menu: [
    { libelle: "Préparation", chemin: "/" },
    { libelle: "Modèles", chemin: "/modeles", masquePourRoles: ["assistance", "invite"] },
    { libelle: "Débrief", chemin: "/debrief", niveauMinimum: "ecriture" },
  ],
  widgets: [...WIDGETS.checklist],
  evenementsEmis: evenementsEmisPar("checklist"),
  evenementsEcoutes: evenementsEcoutesPar("checklist"),
}
