import { evenementsEcoutesPar, evenementsEmisPar } from "@/core/evenements/catalogue"
import { WIDGETS } from "@/core/sdk/widgets-catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Manifeste de Partenaires. Identité : identique au catalogue des apps. Événements et widgets :
// dérivés des catalogues (jamais recopiés), pour qu'ils ne puissent pas diverger.
export const manifestePartenaires: ManifesteApp = {
  cle: "partenaires",
  nom: "Partenaires",
  icone: "handshake",
  version: "0.1.0",
  requiert: ["budget"],
  menu: [
    { libelle: "Prospection", chemin: "/" },
    { libelle: "Contreparties", chemin: "/contreparties" },
    // Les modèles de convention ne se modifient qu'à la gestion.
    { libelle: "Modèles", chemin: "/modeles", niveauMinimum: "gestion" },
  ],
  widgets: [...WIDGETS.partenaires],
  evenementsEmis: evenementsEmisPar("partenaires"),
  evenementsEcoutes: evenementsEcoutesPar("partenaires"),
}
