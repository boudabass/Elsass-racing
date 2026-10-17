import { evenementsEmisPar } from "@/core/evenements/catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Réglages : l'app témoin du contrat. Pas d'écran pour l'instant (tâche ultérieure).
export const manifesteSettings: ManifesteApp = {
  cle: "settings",
  nom: "Réglages",
  icone: "settings",
  version: "0.1.0",
  requiert: [],
  menu: [
    { libelle: "Identité", chemin: "/identite", niveauMinimum: "lecture" },
    { libelle: "Association", chemin: "/association", niveauMinimum: "lecture" },
    { libelle: "Membres", chemin: "/membres", niveauMinimum: "lecture" },
    { libelle: "Rôles et droits", chemin: "/droits", niveauMinimum: "lecture" },
    { libelle: "Apps", chemin: "/apps", niveauMinimum: "lecture" },
    { libelle: "Notifications", chemin: "/notifications" },
    { libelle: "Affichage", chemin: "/affichage" },
    { libelle: "Appareils", chemin: "/appareils" },
    { libelle: "Données et confidentialité", chemin: "/donnees" },
    { libelle: "Mon compte", chemin: "/compte" },
  ],
  widgets: [],
  // Les événements émis par Réglages, tels que déclarés dans le catalogue.
  evenementsEmis: evenementsEmisPar("settings"),
  evenementsEcoutes: [],
}
