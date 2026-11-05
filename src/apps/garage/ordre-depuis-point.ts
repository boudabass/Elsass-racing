// Ordre de travail proposé par un problème signalé dans Check-lists (tâche 5.7a, article 956 §5). Règles pures : le titre
// et les boutons se construisent depuis l'organe, jamais depuis le libellé du point (règle de 5.7a).

export const BOUTONS_ORDRE_DEPUIS_POINT = [
  { cle: "accepter", libelle: "Créer l'ordre" },
  { cle: "ignorer", libelle: "Ignorer" },
] as const

// Titre de l'ordre (et de l'action) : construit depuis le nom de l'organe, avec sa position.
export function titreProbleme(nomOrgane: string): string {
  return `Problème signalé : ${nomOrgane}`
}
