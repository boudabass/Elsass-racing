// Repères des organes sur la vue de dessus (tâche 4.1 ; vue de dessus depuis 4.3e). Coordonnées du cadre de la vue, nez en
// haut (`CADRE_DESSUS`). Un repère par emplacement (`emplacements.ts`) ; sans position, l'organe n'a qu'une carte, sans repère.

import type { Zone } from "./regles"

//
// Rayon de la zone de contact d'un repère, en unités du cadre. Au bureau, 22. Sur téléphone, 25 : dans le cadre de 176
// unités affiché sur 260 px, cela fait un cercle de contact d'environ 74 px. Les cercles de contact ne se coupent jamais,
// à la taille téléphone : un test le vérifie.
export const RAYON_CONTACT_BUREAU = 22
export const RAYON_CONTACT_TELEPHONE = 25

export type PointSilhouette = { x: number; y: number }

// Vue de dessus, nez vers le haut (brief 4.3e, section 4 ; 954 v1.2, « Emplacements et vue du dessus »). Le dessin du
// gabarit est en nez à droite : on le tourne d'un quart de tour. Un point (x, y) du dessin va en (y + 14, 370 − x), soit
// la transformation SVG `matrix(0 -1 1 0 14 370)` posée sur le dessin, et `versCadreDessus` pour les repères. Le côté
// gauche de la voiture reste à gauche de l'écran. Le cadre (176 × 370) laisse entier, à 25 unités, le cercle de contact
// des repères les plus à l'extérieur (x 27 et 151) : il ne sort pas de la vue.
const DECALAGE_DESSUS_X = 14
const DECALAGE_DESSUS_Y = 370

export const CADRE_DESSUS = {
  viewBox: "0 0 176 370",
  transformation: `matrix(0 -1 1 0 ${DECALAGE_DESSUS_X} ${DECALAGE_DESSUS_Y})`,
}

// Un point du dessin (nez à droite) dans le cadre de la vue de dessus (nez en haut).
export function versCadreDessus(point: PointSilhouette): PointSilhouette {
  return { x: point.y + DECALAGE_DESSUS_X, y: DECALAGE_DESSUS_Y - point.x }
}

// Repères de la vue de dessus, dans le repère du dessin `dessus` de la Saxo, nez à droite. Centres des roues (x 66 à
// l'arrière, x 283 à l'avant ; y 13 pour le côté gauche, y 137 pour le côté droit), amortisseurs à 230 (avant) et 120
// (arrière), transmissions à 175, pneus au centre, boîte et embrayage sur l'axe, moteur sous le capot. `pointPourEmplacement`
// les tourne dans le cadre. Le gabarit générique reprend ce dessin : mêmes positions.
const POSITIONS_DESSUS_SAXO: Record<string, Record<string, PointSilhouette>> = {
  moteur: { unique: { x: 338, y: 75 } },
  embrayage: { unique: { x: 283, y: 75 } },
  boite: { unique: { x: 230, y: 75 } },
  transmissions: { gauche: { x: 175, y: 13 }, droite: { x: 175, y: 137 } },
  freins: {
    avant_gauche: { x: 283, y: 13 },
    avant_droit: { x: 283, y: 137 },
    arriere_gauche: { x: 66, y: 13 },
    arriere_droit: { x: 66, y: 137 },
  },
  amortisseurs: {
    avant_gauche: { x: 230, y: 13 },
    avant_droit: { x: 230, y: 137 },
    arriere_gauche: { x: 120, y: 13 },
    arriere_droit: { x: 120, y: 137 },
  },
  pneus: { train: { x: 175, y: 75 } },
}

const POSITIONS_DESSUS_PAR_GABARIT: Record<string, Record<string, Record<string, PointSilhouette>>> = {
  citadine_3p_saxo: POSITIONS_DESSUS_SAXO,
  voiture_generique: POSITIONS_DESSUS_SAXO,
}

// Point d'un emplacement dans le cadre de la vue de dessus d'un gabarit (nez en haut). Null sans gabarit, sans type par
// défaut ou sans position.
export function pointPourEmplacement(
  gabaritCle: string | null,
  organe: { cle: string | null; position: string | null },
): PointSilhouette | null {
  if (!gabaritCle || !organe.cle || !organe.position) return null
  const point = POSITIONS_DESSUS_PAR_GABARIT[gabaritCle]?.[organe.cle]?.[organe.position]
  return point ? versCadreDessus(point) : null
}

// --- Forme du repère ------------------------------------------------------------------------

// Triangle (zone orange), en fractions du rayon r, par rapport au centre du repère : sommet à −1,1 r, base à +0,9 r, demi-base
// de 1,2 r. Il est assez large pour un pourcentage à trois caractères.
export const TRIANGLE_REPERE = { haut: -1.1, bas: 0.9, demiBase: 1.2 }

// Le texte du repère se centre sur la forme. Le triangle fait exception : le texte descend au centre de gravité, où il est
// le plus large (0,2 r sous le centre du repère).
export function decalageTexteRepere(zone: Zone, rayon: number): number {
  return zone === "orange" ? 0.2 * rayon : 0
}

// Largeur de la forme à la hauteur `dy` (écart au centre du repère), en unités du cadre. Sert à vérifier que le texte tient.
export function largeurRepereA(zone: Zone, rayon: number, dy: number): number {
  if (zone === "rouge") return 2 * rayon * (1 - Math.abs(dy) / rayon)
  if (zone === "orange") {
    const hauteur = (TRIANGLE_REPERE.bas - TRIANGLE_REPERE.haut) * rayon
    const t = (dy - TRIANGLE_REPERE.haut * rayon) / hauteur
    return t < 0 || t > 1 ? 0 : 2 * TRIANGLE_REPERE.demiBase * rayon * t
  }
  return 2 * Math.sqrt(Math.max(0, rayon * rayon - dy * dy))
}
