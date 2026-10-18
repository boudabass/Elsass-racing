// Géométrie du plan de déco (brief 3.4). Fonctions pures : le composant et les tests les partagent.
// Les formes stockées sont dans les coordonnées du gabarit (vue droite). La vue gauche est le miroir de la droite,
// calculé ici, jamais stocké : un emplacement symétrique n'a qu'une forme.

import type { FormeEmplacement, VueGabarit } from "./gabarits/types"
import type { StatutEmplacement } from "./regles"

export type VuePlan = "droite" | "gauche"

// Viewbox du gabarit : x, y (coin haut-gauche), l et h (largeur et hauteur).
export interface Bornes {
  x: number
  y: number
  l: number
  h: number
}

// Taille minimale d'un emplacement redimensionné, en unités du plan (brief 3.4, section 3).
export const COTE_MINIMAL = 8
// Taille de la poignée de redimensionnement, en unités du plan.
export const COTE_POIGNEE = 12
// Taille par défaut d'un emplacement ajouté, au centre de la vue.
export const LARGEUR_NOUVEL_EMPLACEMENT = 60
export const HAUTEUR_NOUVEL_EMPLACEMENT = 20

// Emplacement tel que la page le reçoit : données sérialisables, dates en AAAA-MM-JJ.
export interface EmplacementPlan {
  id: string
  nom: string
  vue: VueGabarit
  forme: FormeEmplacement | null
  symetrique: boolean
  largeurCm: number | null
  hauteurCm: number | null
  statut: StatutEmplacement
  occupation: OccupationPlan | null
}

export interface OccupationPlan {
  id: string
  statut: "reserve" | "pose"
  partenaireNom: string
  logoFileId: string | null
  du: string | null
  au: string | null
  photoPoseFileId: string | null
  poseLe: string | null
}

export function bornesDu(viewBox: string): Bornes {
  const [x, y, l, h] = viewBox.trim().split(/\s+/).map(Number)
  return { x, y, l, h }
}

// Axe du miroir : le x minimal du viewBox plus sa largeur. Un x devient axe − x.
function axeDuMiroir(bornes: Bornes): number {
  return bornes.x + bornes.l
}

export function miroirDeForme(forme: FormeEmplacement, bornes: Bornes): FormeEmplacement {
  const axe = axeDuMiroir(bornes)
  if (forme.type === "rect") return { type: "rect", x: axe - forme.x - forme.l, y: forme.y, l: forme.l, h: forme.h }
  return { type: "polygone", points: forme.points.map(([x, y]) => [axe - x, y] as [number, number]) }
}

// La forme telle qu'elle se dessine dans la vue demandée.
export function formeAffichee(forme: FormeEmplacement, vue: VuePlan, bornes: Bornes): FormeEmplacement {
  return vue === "gauche" ? miroirDeForme(forme, bornes) : forme
}

// Emplacements dessinés dans une vue : côté droit, tous les emplacements droits ; côté gauche, les symétriques.
// Les emplacements hors plan n'ont pas de forme et ne se dessinent jamais.
export function emplacementsDessines<T extends { vue: VueGabarit; symetrique: boolean; forme: FormeEmplacement | null }>(
  emplacements: T[],
  vue: VuePlan,
): T[] {
  return emplacements.filter((e) => e.forme !== null && e.vue === "droite" && (vue === "droite" || e.symetrique))
}

// Liste d'une vue : les emplacements dessinés, puis les hors plan (toujours présents, sous « Autres emplacements »).
export function emplacementsDeLaListe<T extends { vue: VueGabarit; symetrique: boolean; forme: FormeEmplacement | null }>(
  emplacements: T[],
  vue: VuePlan,
): { plan: T[]; horsPlan: T[] } {
  return {
    plan: emplacementsDessines(emplacements, vue),
    horsPlan: emplacements.filter((e) => e.vue === "hors_plan"),
  }
}

// Forme d'un nouvel emplacement : un rectangle de 60 × 20 unités au centre du viewBox.
export function formeAuCentre(bornes: Bornes): FormeEmplacement {
  return {
    type: "rect",
    x: bornes.x + bornes.l / 2 - LARGEUR_NOUVEL_EMPLACEMENT / 2,
    y: bornes.y + bornes.h / 2 - HAUTEUR_NOUVEL_EMPLACEMENT / 2,
    l: LARGEUR_NOUVEL_EMPLACEMENT,
    h: HAUTEUR_NOUVEL_EMPLACEMENT,
  }
}

// Boîte englobante d'une forme.
export function etendueDe(forme: FormeEmplacement): { x: number; y: number; l: number; h: number } {
  if (forme.type === "rect") return { x: forme.x, y: forme.y, l: forme.l, h: forme.h }
  const xs = forme.points.map(([x]) => x)
  const ys = forme.points.map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, l: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function borne(valeur: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(valeur, minimum), maximum)
}

// Déplace une forme d'un décalage, sans jamais sortir du viewBox.
export function deplacerForme(forme: FormeEmplacement, dx: number, dy: number, bornes: Bornes): FormeEmplacement {
  const etendue = etendueDe(forme)
  const ddx = borne(dx, bornes.x - etendue.x, bornes.x + bornes.l - (etendue.x + etendue.l))
  const ddy = borne(dy, bornes.y - etendue.y, bornes.y + bornes.h - (etendue.y + etendue.h))
  if (forme.type === "rect") return { type: "rect", x: forme.x + ddx, y: forme.y + ddy, l: forme.l, h: forme.h }
  return { type: "polygone", points: forme.points.map(([x, y]) => [x + ddx, y + ddy] as [number, number]) }
}

// Redimensionne un rectangle par son coin bas-droit. Les polygones ne se redimensionnent pas : la forme est rendue telle quelle.
export function redimensionnerForme(forme: FormeEmplacement, largeur: number, hauteur: number, bornes: Bornes): FormeEmplacement {
  if (forme.type !== "rect") return forme
  const l = borne(largeur, COTE_MINIMAL, bornes.x + bornes.l - forme.x)
  const h = borne(hauteur, COTE_MINIMAL, bornes.y + bornes.h - forme.y)
  return { type: "rect", x: forme.x, y: forme.y, l, h }
}

// Valeur d'une forme saisie dans un champ X, Y, Largeur ou Hauteur : elle reste dans le viewBox et au-dessus du minimum.
export function formeDuChamp(
  forme: FormeEmplacement,
  champ: "x" | "y" | "l" | "h",
  valeur: number,
  bornes: Bornes,
): FormeEmplacement {
  const etendue = etendueDe(forme)
  if (champ === "x") return deplacerForme(forme, valeur - etendue.x, 0, bornes)
  if (champ === "y") return deplacerForme(forme, 0, valeur - etendue.y, bornes)
  if (champ === "l") return redimensionnerForme(forme, valeur, etendue.h, bornes)
  return redimensionnerForme(forme, etendue.l, valeur, bornes)
}

// Lecture d'une forme stockée (colonne JSON) : rien ne passe si la forme n'a pas la bonne structure.
export function formeDeJson(valeur: unknown): FormeEmplacement | null {
  if (typeof valeur !== "object" || valeur === null) return null
  const v = valeur as Record<string, unknown>
  if (v.type === "rect" && [v.x, v.y, v.l, v.h].every((n) => typeof n === "number")) {
    return { type: "rect", x: v.x as number, y: v.y as number, l: v.l as number, h: v.h as number }
  }
  if (v.type === "polygone" && Array.isArray(v.points) && v.points.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number"))) {
    return { type: "polygone", points: v.points as Array<[number, number]> }
  }
  return null
}

// Comptes de la légende : « 3 libres · 1 réservé · 1 occupé · 0 indisponible ».
export interface ComptesStatut {
  libre: number
  reserve: number
  occupe: number
  indisponible: number
}

export function comptesDeStatuts(statuts: StatutEmplacement[]): ComptesStatut {
  const comptes: ComptesStatut = { libre: 0, reserve: 0, occupe: 0, indisponible: 0 }
  for (const statut of statuts) comptes[statut] += 1
  return comptes
}

export function libelleComptes(comptes: ComptesStatut): string {
  const morceau = (nombre: number, singulier: string, pluriel: string) => `${nombre} ${nombre === 1 ? singulier : pluriel}`
  return [
    morceau(comptes.libre, "libre", "libres"),
    morceau(comptes.reserve, "réservé", "réservés"),
    morceau(comptes.occupe, "occupé", "occupés"),
    morceau(comptes.indisponible, "indisponible", "indisponibles"),
  ].join(" · ")
}

// Pas du clavier : 1 unité, 10 avec Maj (brief 3.4, section 3).
export function pasClavier(maj: boolean): number {
  return maj ? 10 : 1
}
