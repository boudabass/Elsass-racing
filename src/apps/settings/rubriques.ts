// Rubriques de Réglages : celles de la team (lecture sur Réglages) et celles de chaque membre.

export const RUBRIQUES_EQUIPE = [
  { chemin: "identite", libelle: "Identité" },
  { chemin: "association", libelle: "Association" },
  { chemin: "membres", libelle: "Membres" },
  { chemin: "droits", libelle: "Rôles et droits" },
  { chemin: "apps", libelle: "Apps" },
] as const

export const RUBRIQUES_PERSONNELLES = [
  { chemin: "notifications", libelle: "Notifications" },
  { chemin: "affichage", libelle: "Affichage" },
  { chemin: "appareils", libelle: "Appareils" },
  { chemin: "donnees", libelle: "Données et confidentialité" },
  { chemin: "compte", libelle: "Mon compte" },
] as const

export function estRubriqueEquipe(chemin: string): boolean {
  return RUBRIQUES_EQUIPE.some((r) => r.chemin === chemin)
}
