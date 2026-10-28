// Garde des écrans de Documents (socle : core/sdk/ecran-serveur.ts), comme Équipe et Partenaires.
// Les écrans lisent au niveau lecture ; chaque action d'écriture se contrôle dans son service.
import type { Niveau } from "@/core/droits/niveaux"
import { accesEcranApp, type AccesEcran } from "@/core/sdk/ecran-serveur"

import { accesDocuments } from "./services-serveur"

export type { AccesEcran }

export const accesEcran = (requis: Niveau) => accesEcranApp("documents", "Documents", accesDocuments, requis)
