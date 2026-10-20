// Garde des écrans de Voiture (socle : core/sdk/ecran-serveur.ts).
import type { Niveau } from "@/core/droits/niveaux"
import { accesEcranApp, type AccesEcran } from "@/core/sdk/ecran-serveur"

import { accesVoiture } from "./services-serveur"

export type { AccesEcran }

export const accesEcran = (requis: Niveau) => accesEcranApp("voiture", "Voiture", accesVoiture, requis)
