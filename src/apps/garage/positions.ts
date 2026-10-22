// Positions des organes sur la silhouette (tâche 4.1, brief §1 ; corrigées en 4.2 après la validation de John sur les
// captures). Coordonnées de la viewBox de la vue droite du gabarit. Par clé de gabarit, puis par clé d'organe par défaut
// (`cle`). Un organe ajouté par la team porte sa position en base (garage_component_type.positions, même clé de gabarit).
// Sans position : l'organe n'a qu'une carte, sans point.
//
// Repères de la Saxo, d'avant en arrière : moteur dans le capot, boîte et embrayage sous l'habitacle avant, transmissions
// entre les deux roues, amortisseurs au-dessus de la roue arrière, freins sur la roue avant, pneus sur la roue arrière.
// Le gabarit générique reprend le dessin de la Saxo (même viewBox, mêmes vues) : mêmes positions.

// Rayon de la zone de contact d'un repère, en unités du plan. Au bureau, 22. Sur téléphone, le repère est plus gros :
// 25 unités, soit 44 px pour la Saxo affichée sur 328 px (370 unités). Les cercles de contact ne se coupent jamais,
// à la taille téléphone : un test le vérifie.
export const RAYON_CONTACT_BUREAU = 22
export const RAYON_CONTACT_TELEPHONE = 25

export type PointSilhouette = { x: number; y: number }

const POSITIONS_SAXO: Record<string, PointSilhouette> = {
  moteur: { x: 306, y: 66 },
  boite: { x: 230, y: 96 },
  embrayage: { x: 146, y: 92 },
  transmissions: { x: 186, y: 128 },
  freins: { x: 282.7, y: 114 },
  amortisseurs: { x: 66, y: 62 },
  pneus: { x: 66.4, y: 114 },
}

const POSITIONS_PAR_GABARIT: Record<string, Record<string, PointSilhouette>> = {
  citadine_3p_saxo: POSITIONS_SAXO,
  voiture_generique: POSITIONS_SAXO,
}

// Un point valide : deux nombres finis, dans la viewBox du gabarit (0 à 370 en x, -14 à 159 en y pour la Saxo).
export function pointValide(valeur: unknown): PointSilhouette | null {
  if (typeof valeur !== "object" || valeur === null) return null
  const { x, y } = valeur as { x?: unknown; y?: unknown }
  if (typeof x !== "number" || typeof y !== "number") return null
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

// Position d'un organe sur la silhouette d'un gabarit. Ordre : la position enregistrée par la team pour ce gabarit,
// puis la position par défaut de l'organe (sa clé). Null si rien ne la donne.
export function pointPourOrgane(
  gabaritCle: string | null,
  organe: { cle: string | null; positions: unknown },
): PointSilhouette | null {
  if (!gabaritCle) return null
  const enregistree = typeof organe.positions === "object" && organe.positions !== null
    ? pointValide((organe.positions as Record<string, unknown>)[gabaritCle])
    : null
  if (enregistree) return enregistree
  if (!organe.cle) return null
  return POSITIONS_PAR_GABARIT[gabaritCle]?.[organe.cle] ?? null
}

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

// Repères de la vue de dessus (brief 4.3e, section 2.2), dans le repère du dessin `dessus` de la Saxo, nez à droite. Un
// repère par emplacement (`emplacements.ts`) : centres des roues (x 66 à l'arrière, x 283 à l'avant ; y 13 pour le côté
// gauche, y 137 pour le côté droit), amortisseurs à 230 (avant) et 120 (arrière), transmissions à 175, pneus au centre,
// boîte et embrayage sur l'axe, moteur sous le capot. `pointPourEmplacement` les tourne dans le cadre.
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
