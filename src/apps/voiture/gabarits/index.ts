import { gabaritSaxo } from "./saxo"
import type { Gabarit } from "./types"

// Catalogue des gabarits de la plateforme. Un véhicule désigne son gabarit par sa clé.
export const GABARITS: Gabarit[] = [gabaritSaxo]

export function gabarit(cle: string): Gabarit | null {
  return GABARITS.find((g) => g.cle === cle) ?? null
}

export type { Gabarit, ElementDessin, EmplacementType, FormeEmplacement, VueGabarit, VueDessinee, RoleDessin } from "./types"
