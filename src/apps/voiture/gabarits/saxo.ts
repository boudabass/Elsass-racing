import type { ElementDessin, Gabarit } from "./types"

// Citadine 3 portes, Citroën Saxo VTS. Source : plan d'emplacements du dossier Koehling
// (saxo_plan_emplacements.svg) pour le profil droit. Les métadonnées, les pastilles numérotées,
// les zones pointillées et la légende du SVG ne sont pas reprises. Les couleurs deviennent des rôles.
// Vue gauche : le dessin droit, retourné à l'affichage. Vues avant, arrière et dessus : dessins schématiques
// (validés par John) dans le même viewBox, à partir du profil. Version 2 : vues avant, arrière et dessus.
// Version 3 : plus de lunette arrière (une vitre n'a pas d'emplacement).

const DESSIN_DROIT: ElementDessin[] = [
  { type: "circle", role: "roue", attributs: { cx: 66.4, cy: 114.0, r: 28.0 } },
  { type: "circle", role: "roue", attributs: { cx: 282.7, cy: 114.0, r: 28.0 } },
  {
    type: "path",
    role: "caisse",
    attributs: {
      d: "M22.8 109.5 L20.0 81.9 Q20.6 67.8 26.2 62.1 L34.0 45.0 Q42.5 33.6 56.5 24.9 L74.8 14.6 Q79.0 12.0 90.2 11.8 L199.8 10.5 Q208.3 10.8 213.9 15.2 L258.9 47.9 Q264.5 51.2 275.7 53.7 L337.5 67.8 Q354.4 71.7 357.8 82.8 L360.0 103.3 L357.2 119.1 L310.0 117.9 A 27.5 27.5 0 1 0 255.5 117.9 L93.6 117.9 A 27.5 27.5 0 1 0 39.1 117.9 L26.2 116.3 Z",
    },
  },
  {
    type: "path",
    role: "vitre",
    attributs: { d: "M72.0 51.2 Q73.4 35.7 87.4 24.2 Q95.9 18.9 109.9 18.1 L140.3 16.8 L138.6 54.5 Z" },
  },
  {
    type: "path",
    role: "vitre",
    attributs: { d: "M147.0 17.2 L202.7 16.6 L239.2 56.0 L145.9 56.0 Z" },
  },
  {
    type: "path",
    role: "detail",
    attributs: { d: "M143.6 14.5 L141.7 116.8", "stroke-width": 2.2 },
  },
  {
    type: "path",
    role: "detail",
    attributs: { d: "M242.0 51.7 L247.6 116.8", "stroke-width": 2.2 },
  },
  { type: "path", role: "detail", attributs: { d: "M25.1 64.3 L40.8 64.0 L40.8 78.0 L23.4 79.0 Z" } },
  { type: "path", role: "detail", attributs: { d: "M329.7 73.3 L348.8 74.0 L351.6 84.7 L332.5 83.4 Z" } },
  { type: "line", role: "detail", attributs: { x1: 90.2, y1: 84.2, x2: 256.0, y2: 84.2, "stroke-width": 4 } },
  { type: "circle", role: "roue", attributs: { cx: 66.4, cy: 114.0, r: 24.7 } },
  { type: "circle", role: "roue", attributs: { cx: 282.7, cy: 114.0, r: 24.7 } },
  { type: "circle", role: "jante", attributs: { cx: 66.4, cy: 114.0, r: 16.3 } },
  { type: "circle", role: "jante", attributs: { cx: 282.7, cy: 114.0, r: 16.3 } },
  { type: "circle", role: "detail", attributs: { cx: 66.4, cy: 114.0, r: 5.4 } },
  { type: "circle", role: "detail", attributs: { cx: 282.7, cy: 114.0, r: 5.4 } },
  { type: "line", role: "sol", attributs: { x1: 0, y1: 142.5, x2: 370, y2: 142.5, "stroke-width": 1.5 } },
]

// Angles arrondis en chemin : pneus, plaque, rétroviseurs.
function rectArrondi(x: number, y: number, l: number, h: number, r: number): string {
  return `M ${x + r} ${y} L ${x + l - r} ${y} Q ${x + l} ${y} ${x + l} ${y + r} L ${x + l} ${y + h - r} Q ${x + l} ${y + h} ${x + l - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`
}

// Vues de face et de dos : carrosserie à montants inclinés, toit plat plus étroit que la caisse, pare-brise et lunette
// en trapèze. Les roues dépassent un peu sous la caisse.
const CAISSE_FACE: ElementDessin = {
  type: "path",
  role: "caisse",
  attributs: { d: "M 110 132 Q 105 132 105 124 L 105 78 Q 105 70 110 66 L 124 60 L 132 22 Q 133 16 142 16 L 228 16 Q 237 16 238 22 L 246 60 L 260 66 Q 265 70 265 78 L 265 124 Q 265 132 260 132 Z" },
}

const ROUES_FACE: ElementDessin[] = [
  { type: "path", role: "roue", attributs: { d: rectArrondi(94, 110, 24, 32, 6) } },
  { type: "path", role: "roue", attributs: { d: rectArrondi(252, 110, 24, 32, 6) } },
]

const DESSIN_AVANT: ElementDessin[] = [
  ...ROUES_FACE,
  CAISSE_FACE,
  { type: "path", role: "vitre", attributs: { d: "M 137 27 L 233 27 L 243 58 L 127 58 Z" } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 66, x2: 260, y2: 66, "stroke-width": 1.5 } },
  { type: "path", role: "detail", attributs: { d: "M 110 72 L 148 70 L 150 90 Q 128 94 108 88 Z" } },
  { type: "path", role: "detail", attributs: { d: "M 260 72 L 222 70 L 220 90 Q 242 94 262 88 Z" } },
  { type: "path", role: "detail", attributs: { d: "M 156 74 L 214 74 L 212 100 L 158 100 Z" } },
  { type: "line", role: "detail", attributs: { x1: 164, y1: 84, x2: 206, y2: 84, "stroke-width": 1 } },
  { type: "line", role: "detail", attributs: { x1: 164, y1: 92, x2: 206, y2: 92, "stroke-width": 1 } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(124, 110, 26, 14, 3) } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(220, 110, 26, 14, 3) } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 126, x2: 260, y2: 126, "stroke-width": 1.2 } },
  { type: "path", role: "caisse", attributs: { d: rectArrondi(91, 52, 14, 14, 4) } },
  { type: "path", role: "caisse", attributs: { d: rectArrondi(265, 52, 14, 14, 4) } },
  { type: "line", role: "sol", attributs: { x1: 0, y1: 144.5, x2: 370, y2: 144.5, "stroke-width": 1.5 } },
]

const DESSIN_ARRIERE: ElementDessin[] = [
  ...ROUES_FACE,
  CAISSE_FACE,
  { type: "path", role: "vitre", attributs: { d: "M 137 27 L 233 27 L 243 58 L 127 58 Z" } },
  { type: "path", role: "detail", attributs: { d: "M 152 48 Q 185 40 218 46", "stroke-width": 1.2 } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 64, x2: 260, y2: 64, "stroke-width": 1.5 } },
  { type: "path", role: "detail", attributs: { d: "M 108 72 Q 116 69 122 70 L 122 98 Q 116 100 108 98 Z" } },
  { type: "path", role: "detail", attributs: { d: "M 262 72 Q 254 69 248 70 L 248 98 Q 254 100 262 98 Z" } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(160, 88, 50, 16, 2), "stroke-width": 1 } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 114, x2: 260, y2: 114, "stroke-width": 1.2 } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 126, x2: 260, y2: 126, "stroke-width": 1.2 } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(110, 118, 14, 7, 2) } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(246, 118, 14, 7, 2) } },
  { type: "line", role: "sol", attributs: { x1: 0, y1: 144.5, x2: 370, y2: 144.5, "stroke-width": 1.5 } },
]

// Vue de dessus : la carrosserie vue du ciel, nez à droite (capot, pare-brise), coffre à gauche (lunette, hayon).
// Les roues dépassent de la caisse ; les rétroviseurs sortent au pied du pare-brise.
const DESSIN_DESSUS: ElementDessin[] = [
  { type: "path", role: "roue", attributs: { d: rectArrondi(53, 2, 26, 22, 4) } },
  { type: "path", role: "roue", attributs: { d: rectArrondi(53, 126, 26, 22, 4) } },
  { type: "path", role: "roue", attributs: { d: rectArrondi(270, 2, 26, 22, 4) } },
  { type: "path", role: "roue", attributs: { d: rectArrondi(270, 126, 26, 22, 4) } },
  {
    type: "path",
    role: "caisse",
    attributs: { d: "M 60 13 L 282 13 Q 318 13 336 30 Q 350 44 352 75 Q 350 106 336 120 Q 318 137 282 137 L 60 137 Q 30 137 24 112 L 22 75 L 24 38 Q 30 13 60 13 Z" },
  },
  { type: "path", role: "vitre", attributs: { d: "M 262 26 Q 282 18 298 20 L 298 130 Q 282 132 262 124 Z" } },
  { type: "path", role: "vitre", attributs: { d: "M 64 24 Q 80 16 90 22 L 90 128 Q 80 134 64 126 Z" } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(98, 26, 158, 98, 10) } },
  { type: "line", role: "detail", attributs: { x1: 298, y1: 20, x2: 298, y2: 130, "stroke-width": 1.2 } },
  { type: "path", role: "detail", attributs: { d: "M 300 34 Q 326 38 346 52 M 300 116 Q 326 112 346 98", "stroke-width": 1 } },
  { type: "path", role: "caisse", attributs: { d: rectArrondi(248, 4, 18, 9, 3) } },
  { type: "path", role: "caisse", attributs: { d: rectArrondi(248, 137, 18, 9, 3) } },
]

export const gabaritSaxo: Gabarit = {
  cle: "citadine_3p_saxo",
  nom: "Citadine 3 portes (Saxo)",
  categorie: "citadine_3p",
  version: 3,
  viewBox: "0 -14 370 173",
  vuesDessinees: [
    { vue: "droite", dessin: DESSIN_DROIT },
    { vue: "gauche", miroirDe: "droite" },
    { vue: "avant", dessin: DESSIN_AVANT },
    { vue: "arriere", dessin: DESSIN_ARRIERE },
    { vue: "dessus", dessin: DESSIN_DESSUS },
  ],
  emplacementsTypes: [
    { ordre: 1, nom: "Portière", vue: "droite", symetrique: true, forme: { type: "rect", x: 150.7, y: 61.2, l: 87.1, h: 17.4 } },
    { ordre: 2, nom: "Custode arrière", vue: "droite", symetrique: true, forme: { type: "rect", x: 75.6, y: 61.2, l: 60.1, h: 17.4 } },
    { ordre: 3, nom: "Aile avant", vue: "droite", symetrique: true, forme: { type: "rect", x: 254.6, y: 69.0, l: 61.8, h: 12.4 } },
    { ordre: 4, nom: "Aile arrière", vue: "droite", symetrique: true, forme: { type: "rect", x: 29.6, y: 78.0, l: 23.0, h: 13.5 } },
    {
      ordre: 5,
      nom: "Bandeau de pare-brise",
      vue: "droite",
      symetrique: false,
      forme: {
        type: "polygone",
        points: [
          [204.3, 17.7],
          [215.6, 16.3],
          [230.8, 27.2],
          [215.6, 29.2],
        ],
      },
    },
    { ordre: 6, nom: "Bas de caisse", vue: "droite", symetrique: true, forme: { type: "rect", x: 101.5, y: 91.5, l: 143.3, h: 18.0 } },
    { ordre: 7, nom: "Capot", vue: "dessus", symetrique: false, forme: { type: "rect", x: 300, y: 22, l: 44, h: 100 } },
    { ordre: 8, nom: "Hayon", vue: "arriere", symetrique: false, forme: { type: "rect", x: 112, y: 66, l: 146, h: 46 } },
    { ordre: 9, nom: "Toit", vue: "dessus", symetrique: false, forme: { type: "rect", x: 100, y: 22, l: 150, h: 100 } },
    { ordre: 10, nom: "Pare-chocs avant", vue: "avant", symetrique: false, forme: { type: "rect", x: 110, y: 110, l: 150, h: 22 } },
    { ordre: 11, nom: "Pare-chocs arrière", vue: "arriere", symetrique: false, forme: { type: "rect", x: 110, y: 114, l: 150, h: 18 } },
  ],
  nomsRetires: ["Lunette arrière"],
}
