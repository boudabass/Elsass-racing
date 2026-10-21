import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Garage. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteGarage: ManifesteApp = {
  cle: "garage",
  nom: "Garage",
  icone: "wrench",
  version: "0.2.0",
  requiert: ["voiture"],
  menu: [
    { libelle: "Atelier", chemin: "/" },
    { libelle: "Stock", chemin: "/stock" },
    { libelle: "Travaux", chemin: "/travaux" },
    { libelle: "Commandes", chemin: "/commandes", niveauMinimum: "ecriture" },
  ],
  widgets: [...WIDGETS.garage],
  evenementsEmis: evenementsEmisPar("garage"),
  evenementsEcoutes: evenementsEcoutesPar("garage"),
}
