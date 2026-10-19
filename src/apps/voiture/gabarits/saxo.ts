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

// Silhouette de face et de dos : même carrosserie, vitrage en haut, bouclier en bas.
const CAISSE_FACE: ElementDessin = {
  type: "path",
  role: "caisse",
  attributs: { d: "M100 30 Q100 4 126 4 L244 4 Q270 4 270 30 L270 128 Q270 144 254 144 L116 144 Q100 144 100 128 Z" },
}

const DESSIN_AVANT: ElementDessin[] = [
  CAISSE_FACE,
  { type: "path", role: "vitre", attributs: { d: "M118 20 Q118 12 128 12 L242 12 Q252 12 252 20 L252 58 L118 58 Z" } },
  { type: "line", role: "detail", attributs: { x1: 104, y1: 62, x2: 266, y2: 62, "stroke-width": 1.5 } },
  { type: "path", role: "detail", attributs: { d: "M104 66 L120 66 L120 84 L104 84 Z" } },
  { type: "path", role: "detail", attributs: { d: "M250 66 L266 66 L266 84 L250 84 Z" } },
  { type: "path", role: "detail", attributs: { d: "M150 96 L220 96 L220 116 L150 116 Z" } },
  { type: "line", role: "sol", attributs: { x1: 0, y1: 144.5, x2: 370, y2: 144.5, "stroke-width": 1.5 } },
]

const DESSIN_ARRIERE: ElementDessin[] = [
  CAISSE_FACE,
  { type: "path", role: "vitre", attributs: { d: "M118 20 Q118 12 128 12 L242 12 Q252 12 252 20 L252 58 L118 58 Z" } },
  { type: "line", role: "detail", attributs: { x1: 104, y1: 62, x2: 266, y2: 62, "stroke-width": 1.5 } },
  { type: "path", role: "detail", attributs: { d: "M104 66 L118 66 L118 90 L104 90 Z" } },
  { type: "path", role: "detail", attributs: { d: "M252 66 L266 66 L266 90 L252 90 Z" } },
  { type: "line", role: "sol", attributs: { x1: 0, y1: 144.5, x2: 370, y2: 144.5, "stroke-width": 1.5 } },
]

// Vue de dessus : carrosserie vue du ciel, pare-brise à droite (avant), lunette à gauche (arrière).
const DESSIN_DESSUS: ElementDessin[] = [
  {
    type: "path",
    role: "caisse",
    attributs: { d: "M40 2 L320 2 Q350 2 350 34 L350 110 Q350 142 320 142 L40 142 Q20 142 20 110 L20 34 Q20 2 40 2 Z" },
  },
  { type: "path", role: "vitre", attributs: { d: "M262 26 L298 14 L298 130 L262 118 Z" } },
  { type: "path", role: "vitre", attributs: { d: "M62 22 L90 14 L90 130 L62 122 Z" } },
  { type: "path", role: "detail", attributs: { d: "M98 14 L250 14 L250 130 L98 130 Z", "stroke-width": 1.5 } },
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
