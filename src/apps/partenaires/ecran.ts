// Garde des écrans de Partenaires (socle : core/sdk/ecran-serveur.ts), comme Voiture.
// Responsable : gestion. Équipage : écriture. Assistance et invité : aucun accès, donc la page de refus du socle.
import type { Niveau } from "@/core/droits/niveaux"
import { accesEcranApp, type AccesEcran } from "@/core/sdk/ecran-serveur"

import { accesPartenaires } from "./services-serveur"

export type { AccesEcran }

export const accesEcran = (requis: Niveau) => accesEcranApp("partenaires", "Partenaires", accesPartenaires, requis)
