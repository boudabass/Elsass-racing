// Mise en forme de l'atelier (tâche 4.2, brief §1). Module pur, sans accès base : il est testé seul. Le mot de la zone
// et l'ordre des cartes viennent d'ici ; les seuils sont ceux des pièces (regles.ts), jamais recopiés.

import { SEUILS_DEFAUT, zoneDeEtat, type Zone } from "./regles"

// Mot de la zone : ce que l'écran écrit à côté de l'état. La zone se lit aussi par la forme, jamais par la couleur seule.
export const LIBELLE_ZONE: Record<Zone, string> = {
  vert: "Bon",
  orange: "À surveiller",
  rouge: "À changer",
  a_renseigner: "À renseigner",
}

export function libelleZone(zone: Zone): string {
  return LIBELLE_ZONE[zone]
}

// Zone de l'indice de fiabilité : même seuils que les pièces. Sans indice, « À renseigner ».
export function zoneIndice(indice: number | null): Zone {
  return zoneDeEtat(indice, SEUILS_DEFAUT)
}

// État en pourcentage, entier, avec l'espace insécable avant « % ». Null sans état.
export function pourcentage(etat: number | null): string | null {
  if (etat === null) return null
  return `${Math.round(etat)} %`
}

// Cartes : les organes critiques d'abord, puis l'ordre des types (déjà celui de la base). Le tri est stable.
export function ordreDesOrganes<T extends { critique: boolean }>(organes: T[]): T[] {
  return [...organes].sort((a, b) => Number(b.critique) - Number(a.critique))
}

// Km restants avant la zone rouge, en phrase. Null quand la durée ne le permet pas.
export function phraseKmRestants(km: number | null): string | null {
  if (km === null) return null
  if (km === 0) return "Zone rouge atteinte"
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(km))} km avant la zone rouge`
}

// Organe vu par le mot de l'indice : seuls comptent les critiques avec une pièce montée et un état connu (comme la moyenne).
export type OrganeMot = { nom: string; critique: boolean; pieceMontee: boolean; zone: Zone }

const RANG_ZONE: Record<Zone, number> = { a_renseigner: 0, vert: 1, orange: 2, rouge: 3 }

// Nom d'organe dans une phrase : l'initiale en minuscule (« boîte de vitesses »).
function dansUnePhrase(nom: string): string {
  return nom.charAt(0).toLocaleLowerCase("fr-FR") + nom.slice(1)
}

// Liste de noms, à la française : « embrayage », « embrayage et 1 autre », « embrayage et 2 autres ».
export function enumererOrganes(noms: string[]): string {
  if (noms.length === 1) return noms[0]
  return `${noms[0]} et ${noms.length - 1} autre${noms.length > 2 ? "s" : ""}`
}

// Mot de l'indice : le pire organe critique renseigné. Un rouge l'emporte sur un orange, et le mot nomme les organes de
// cette zone. Sans rouge ni orange, « Bon » ; sans organe retenu, « À renseigner ».
export function motIndice(organes: OrganeMot[]): string {
  const retenus = organes.filter((o) => o.critique && o.pieceMontee && o.zone !== "a_renseigner")
  if (retenus.length === 0) return LIBELLE_ZONE.a_renseigner
  const pire = retenus.reduce<Zone>((zone, o) => (RANG_ZONE[o.zone] > RANG_ZONE[zone] ? o.zone : zone), "vert")
  if (pire === "vert") return LIBELLE_ZONE.vert
  const noms = retenus.filter((o) => o.zone === pire).map((o) => dansUnePhrase(o.nom))
  return `${LIBELLE_ZONE[pire]} : ${enumererOrganes(noms)}`
}

// Ce qui manque à l'indice quand il n'y en a pas : les organes critiques sans pièce, par leur nom.
export function phraseManque(noms: string[]): string {
  if (noms.length === 0) return "Aucun organe critique sans pièce montée."
  return `Il manque une pièce montée sur : ${noms.join(", ")}.`
}
