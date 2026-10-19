import { gabaritGenerique } from "./generique"
import { gabaritSaxo } from "./saxo"
import type { Gabarit } from "./types"

export { CLE_GABARIT_GENERIQUE } from "./generique"

// Catalogue des gabarits de la plateforme. Un véhicule désigne son gabarit par sa clé. Le générique vient en premier :
// c'est le modèle proposé par défaut.
export const GABARITS: Gabarit[] = [gabaritGenerique, gabaritSaxo]

export function gabarit(cle: string): Gabarit | null {
  return GABARITS.find((g) => g.cle === cle) ?? null
}

export type { Gabarit, ElementDessin, EmplacementType, FormeEmplacement, VueGabarit, VueDessinee, RoleDessin } from "./types"
