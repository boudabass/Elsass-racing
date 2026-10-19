// Gabarit « Voiture générique » (tâche 3.15, point 6) : le modèle par défaut d'un véhicule créé sans marque. Il porte
// les 11 emplacements validés (pairs et uniques), et aucun sur la lunette arrière. Le dessin est PROVISOIRE : il reprend
// la silhouette de la Saxo, en attendant le dessin définitif, fait après la validation par John des vues de la Saxo.
import { gabaritSaxo } from "./saxo"
import type { Gabarit } from "./types"

// Clé stockée sur le véhicule (gabarit_cle). Elle ne change jamais : c'est l'identifiant du modèle.
export const CLE_GABARIT_GENERIQUE = "voiture_generique"

export const gabaritGenerique: Gabarit = {
  cle: CLE_GABARIT_GENERIQUE,
  nom: "Voiture générique",
  categorie: "generique",
  version: 1,
  viewBox: gabaritSaxo.viewBox,
  vuesDessinees: gabaritSaxo.vuesDessinees,
  emplacementsTypes: gabaritSaxo.emplacementsTypes,
}
