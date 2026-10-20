// Positions des organes sur la silhouette (tâche 4.1, brief §1). Coordonnées de la viewBox de la vue droite du gabarit.
// Par clé de gabarit, puis par clé d'organe par défaut (`cle`). Un organe ajouté par la team porte sa position en base
// (garage_component_type.positions, même clé de gabarit). Sans position : l'organe n'a qu'une carte, sans point.
//
// Choix provisoires, à valider sur l'écran en 4.2 : le profil de la Saxo est dessiné avec l'avant à droite (roue
// avant en x = 282,7). Freins sur la roue avant, pneus sur la roue arrière : un seul point par organe par défaut.
// Le gabarit générique reprend le dessin de la Saxo (même viewBox, mêmes vues) : mêmes positions.

export type PointSilhouette = { x: number; y: number }

const POSITIONS_SAXO: Record<string, PointSilhouette> = {
  moteur: { x: 250, y: 84 },
  boite: { x: 210, y: 100 },
  embrayage: { x: 232, y: 104 },
  transmissions: { x: 170, y: 112 },
  freins: { x: 282.7, y: 114 },
  amortisseurs: { x: 255, y: 78 },
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
