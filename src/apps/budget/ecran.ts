// Garde des écrans de Budget (socle : core/sdk/ecran-serveur.ts).
import type { Niveau } from "@/core/droits/niveaux"
import { accesEcranApp, type AccesEcran } from "@/core/sdk/ecran-serveur"

import { accesBudget } from "./services-serveur"

export type { AccesEcran }

export const accesEcran = (requis: Niveau) => accesEcranApp("budget", "Budget", accesBudget, requis)
