// Garde des écrans du Garage (socle : core/sdk/ecran-serveur.ts).
import type { Niveau } from "@/core/droits/niveaux"
import { accesEcranApp, type AccesEcran } from "@/core/sdk/ecran-serveur"

import { accesGarage } from "./services-serveur"

export type { AccesEcran }

export const accesEcran = (requis: Niveau) => accesEcranApp("garage", "Garage", accesGarage, requis)
