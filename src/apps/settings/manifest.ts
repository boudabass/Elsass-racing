import { EVENEMENTS } from "@/core/evenements/catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

// Réglages : l'app témoin du contrat. Pas d'écran pour l'instant (tâche ultérieure).
export const manifesteSettings: ManifesteApp = {
  cle: "settings",
  nom: "Réglages",
  icone: "settings",
  version: "0.1.0",
  requiert: [],
  menu: [
    { libelle: "Identité", chemin: "/identite" },
    { libelle: "Association", chemin: "/association" },
    { libelle: "Membres", chemin: "/membres" },
    { libelle: "Rôles et droits", chemin: "/droits" },
    { libelle: "Apps", chemin: "/apps" },
    { libelle: "Notifications", chemin: "/notifications" },
    { libelle: "Affichage", chemin: "/affichage" },
    { libelle: "Appareils", chemin: "/appareils" },
    { libelle: "Données et confidentialité", chemin: "/donnees" },
    { libelle: "Mon compte", chemin: "/compte" },
  ],
  widgets: [],
  // Les événements émis par Réglages, tels que déclarés dans le catalogue.
  evenementsEmis: EVENEMENTS.filter((evenement) => evenement.emisPar === "settings").map((evenement) => evenement.nom),
  evenementsEcoutes: [],
}
