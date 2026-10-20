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

// Ce qui manque à l'indice quand il n'y en a pas : les organes critiques sans pièce, par leur nom.
export function phraseManque(noms: string[]): string {
  if (noms.length === 0) return "Aucun organe critique sans pièce montée."
  return `Il manque une pièce montée sur : ${noms.join(", ")}.`
}
