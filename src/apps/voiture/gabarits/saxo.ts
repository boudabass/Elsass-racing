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

// Vues de face et de dos : même carrosserie, pare-brise ou lunette en haut, pare-chocs en bas, roues qui dépassent.
const CAISSE_FACE: ElementDessin = {
  type: "path",
  role: "caisse",
  attributs: { d: "M 110 132 Q 105 132 105 124 L 105 84 Q 105 72 112 66 L 122 56 Q 132 22 185 16 Q 238 22 248 56 L 258 66 Q 265 72 265 84 L 265 124 Q 265 132 260 132 Z" },
}

const ROUES_FACE: ElementDessin[] = [
  { type: "path", role: "roue", attributs: { d: rectArrondi(94, 110, 24, 32, 6) } },
  { type: "path", role: "roue", attributs: { d: rectArrondi(252, 110, 24, 32, 6) } },
]

const DESSIN_AVANT: ElementDessin[] = [
  ...ROUES_FACE,
  CAISSE_FACE,
  { type: "path", role: "vitre", attributs: { d: "M 128 60 Q 140 32 185 29 Q 230 32 242 60 Z" } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 68, x2: 260, y2: 68, "stroke-width": 1.5 } },
  { type: "path", role: "detail", attributs: { d: "M 116 76 Q 126 68 142 70 L 144 86 Q 128 90 114 86 Z" } },
  { type: "path", role: "detail", attributs: { d: "M 254 72 Q 244 68 228 70 L 226 86 Q 242 90 256 86 Z" } },
  { type: "path", role: "detail", attributs: { d: "M 156 74 Q 185 69 214 74 L 216 98 Q 185 102 154 98 Z" } },
  { type: "line", role: "detail", attributs: { x1: 160, y1: 83, x2: 210, y2: 83, "stroke-width": 1 } },
  { type: "line", role: "detail", attributs: { x1: 160, y1: 90, x2: 210, y2: 90, "stroke-width": 1 } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(126, 108, 24, 14, 3) } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(220, 108, 24, 14, 3) } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 126, x2: 260, y2: 126, "stroke-width": 1.2 } },
  { type: "path", role: "caisse", attributs: { d: rectArrondi(92, 58, 13, 16, 4) } },
  { type: "path", role: "caisse", attributs: { d: rectArrondi(265, 58, 13, 16, 4) } },
  { type: "line", role: "sol", attributs: { x1: 0, y1: 144.5, x2: 370, y2: 144.5, "stroke-width": 1.5 } },
]

const DESSIN_ARRIERE: ElementDessin[] = [
  ...ROUES_FACE,
  CAISSE_FACE,
  { type: "path", role: "vitre", attributs: { d: "M 126 58 Q 138 28 185 25 Q 232 28 244 58 Z" } },
  { type: "path", role: "detail", attributs: { d: "M 150 52 Q 186 44 222 50", "stroke-width": 1.2 } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 62, x2: 260, y2: 62, "stroke-width": 1.5 } },
  { type: "path", role: "detail", attributs: { d: "M 108 68 Q 116 65 122 66 L 122 94 Q 116 96 108 96 Z" } },
  { type: "path", role: "detail", attributs: { d: "M 262 68 Q 254 65 248 66 L 248 94 Q 254 96 262 96 Z" } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 114, x2: 260, y2: 114, "stroke-width": 1.2 } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(160, 90, 50, 16, 2), "stroke-width": 1 } },
  { type: "line", role: "detail", attributs: { x1: 110, y1: 126, x2: 260, y2: 126, "stroke-width": 1.2 } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(110, 119, 14, 8, 2) } },
  { type: "path", role: "detail", attributs: { d: rectArrondi(246, 119, 14, 8, 2) } },
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
    { ordre: 8, nom: "Hayon", vue: "arriere", symetrique: false, forme: { type: "rect", x: 112, y: 64, l: 146, h: 50 } },
    { ordre: 9, nom: "Toit", vue: "dessus", symetrique: false, forme: { type: "rect", x: 100, y: 22, l: 150, h: 100 } },
    { ordre: 10, nom: "Pare-chocs avant", vue: "avant", symetrique: false, forme: { type: "rect", x: 108, y: 118, l: 154, h: 22 } },
    { ordre: 11, nom: "Pare-chocs arrière", vue: "arriere", symetrique: false, forme: { type: "rect", x: 108, y: 118, l: 154, h: 22 } },
  ],
  nomsRetires: ["Lunette arrière"],
}
