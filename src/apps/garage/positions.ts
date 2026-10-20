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
