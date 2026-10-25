// Garde des écrans d'Équipe (socle : core/sdk/ecran-serveur.ts), comme Partenaires et Voiture.
// Les écrans lisent au niveau lecture ; chaque action d'écriture se contrôle dans son service.
import type { Niveau } from "@/core/droits/niveaux"
import { accesEcranApp, type AccesEcran } from "@/core/sdk/ecran-serveur"

import { accesEquipe } from "./services-serveur"

export type { AccesEcran }

export const accesEcran = (requis: Niveau) => accesEcranApp("equipe", "Équipe", accesEquipe, requis)
