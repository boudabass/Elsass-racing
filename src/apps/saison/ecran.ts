// Garde des écrans de Saison (socle : core/sdk/ecran-serveur.ts).
import type { Niveau } from "@/core/droits/niveaux"
import { accesEcranApp, type AccesEcran } from "@/core/sdk/ecran-serveur"

import { accesSaison } from "./services-serveur"

export type { AccesEcran }

export const accesEcran = (requis: Niveau) => accesEcranApp("saison", "Saison", accesSaison, requis)
