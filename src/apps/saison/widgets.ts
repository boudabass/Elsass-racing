// Widgets de Saison : résumés purs, testés. Les lectures en base sont dans widgets-serveur.ts.
// Pas d'affichage ici : le Tableau de bord arrive au lot 6.

import type { CouleurIndice, IndicePreparation } from "./regles"

const RANG_COULEUR: Record<CouleurIndice, number> = { vert: 0, orange: 1, rouge: 2 }

// Préparation d'une épreuve : l'engagement le moins prêt donne le ton (plus bas pourcentage, couleur la plus grave).
export function resumerPreparation(indices: readonly IndicePreparation[]): IndicePreparation | null {
  if (indices.length === 0) return null
  const pourcentage = Math.min(...indices.map((indice) => indice.pourcentage))
  const couleur = indices.reduce<CouleurIndice>((pire, indice) => (RANG_COULEUR[indice.couleur] > RANG_COULEUR[pire] ? indice.couleur : pire), "vert")
  return { pourcentage, couleur }
}

export function libelleResultatsAValider(nombre: number): string {
  if (nombre === 0) return "Aucun résultat à valider"
  if (nombre === 1) return "1 résultat à valider"
  return `${nombre} résultats à valider`
}

export function libelleBilan(bilan: { partis: number; arrivees: number; abandons: number; km: number }): string {
  const km = Math.round(bilan.km * 10) / 10
  return `${bilan.partis} parti${bilan.partis > 1 ? "s" : ""} · ${bilan.arrivees} arrivée${bilan.arrivees > 1 ? "s" : ""} · ${bilan.abandons} abandon${bilan.abandons > 1 ? "s" : ""} · ${km} km`
}
