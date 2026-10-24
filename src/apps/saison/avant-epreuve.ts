// Données de Saison pour le plan avant épreuve de Garage (tâche 4.5). Règles pures, sans accès base.

// Kilomètres de spéciale prévus : longueur × passages, comme le reste de Saison (un passage si vide). Les spéciales
// sans longueur ne comptent pas ; sans aucune longueur saisie, rien n'est prévu (null).
export function kmPrevusDesSpeciales(speciales: Array<{ longueurKm: number | null; nbPassages: number | null }>): number | null {
  const avecLongueur = speciales.filter((special) => special.longueurKm !== null)
  if (avecLongueur.length === 0) return null
  return avecLongueur.reduce((total, special) => total + (special.longueurKm ?? 0) * (special.nbPassages ?? 1), 0)
}
