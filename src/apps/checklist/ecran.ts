// Garde des écrans de Check-lists (socle : core/sdk/ecran-serveur.ts), comme Équipe et Partenaires.
// Les écrans lisent au niveau lecture ; chaque écriture se contrôle dans son service.
import type { Niveau } from "@/core/droits/niveaux"
import { accesEcranApp, type AccesEcran } from "@/core/sdk/ecran-serveur"

import { accesChecklist } from "./services-serveur"

export type { AccesEcran }

export const accesEcran = (requis: Niveau) => accesEcranApp("checklist", "Check-lists", accesChecklist, requis)
