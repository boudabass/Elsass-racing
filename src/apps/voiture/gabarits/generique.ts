// Gabarit « Voiture générique » (tâche 3.15, point 6) : le modèle par défaut d'un véhicule créé sans marque. Il porte
// les 11 emplacements validés (pairs et uniques), et aucun sur la lunette arrière. Le dessin est PROVISOIRE : il reprend
// la silhouette de la Saxo, en attendant le dessin définitif, fait après la validation par John des vues de la Saxo.
import { gabaritSaxo } from "./saxo"
import type { FormeEmplacement, Gabarit } from "./types"

// Clé stockée sur le véhicule (gabarit_cle). Elle ne change jamais : c'est l'identifiant du modèle.
export const CLE_GABARIT_GENERIQUE = "voiture_generique"

// Formes que le générique a portées avant sa version 3, par emplacement (le complément les reconnaît pour remettre la
// forme actuelle). Version 1 : formes de la Saxo version 3. Version 2 : formes de la Saxo version 4 (roues agrandies,
// profil compris). La version 3 revient au profil de la Saxo version 3 : seules les formes de la version 2 du profil et
// les formes de la version 1 des autres zones restent à reconnaître.
const FORMES_ANTERIEURES: Record<string, FormeEmplacement[]> = {
  "Custode arrière": [{ type: "rect", x: 100, y: 61.2, l: 35.7, h: 17.4 }],
  "Aile avant": [{ type: "rect", x: 256, y: 55, l: 28, h: 8 }],
  "Aile arrière": [{ type: "rect", x: 29, y: 57, l: 23, h: 8 }],
  "Bas de caisse": [{ type: "rect", x: 108, y: 91.5, l: 133, h: 18 }],
  Hayon: [{ type: "rect", x: 112, y: 66, l: 146, h: 46 }],
  "Pare-chocs avant": [{ type: "rect", x: 110, y: 110, l: 150, h: 22 }],
  "Pare-chocs arrière": [{ type: "rect", x: 110, y: 114, l: 150, h: 18 }],
}

export const gabaritGenerique: Gabarit = {
  cle: CLE_GABARIT_GENERIQUE,
  nom: "Voiture générique",
  categorie: "generique",
  version: 3,
  viewBox: gabaritSaxo.viewBox,
  vuesDessinees: gabaritSaxo.vuesDessinees,
  emplacementsTypes: gabaritSaxo.emplacementsTypes.map((type) => ({ ...type, formesAnterieures: FORMES_ANTERIEURES[type.nom] })),
}
