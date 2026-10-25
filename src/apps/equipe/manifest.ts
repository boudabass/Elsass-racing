import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Équipe. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifesteEquipe: ManifesteApp = {
  cle: "equipe",
  nom: "Équipe",
  icone: "users",
  version: "0.2.0",
  requiert: [],
  menu: [
    { libelle: "L'équipe", chemin: "/" },
    { libelle: "Prochaine épreuve", chemin: "/epreuve" },
    { libelle: "Binômes", chemin: "/binomes" },
    { libelle: "Vivier", chemin: "/vivier" },
  ],
  widgets: [...WIDGETS.equipe],
  evenementsEmis: evenementsEmisPar("equipe"),
  evenementsEcoutes: evenementsEcoutesPar("equipe"),
}
