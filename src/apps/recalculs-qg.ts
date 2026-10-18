// Recalculs à l'ouverture du QG (tâche 3.2, brief section 5). Couche de composition, sur le modèle de
// src/apps/onglets-fiches.ts : ce fichier connaît les apps qui recalculent, pas le QG. La page du QG
// n'appelle plus que `recalculerQg`.
//
// Chaque app isole ses erreurs : un échec est journalisé et n'empêche ni l'autre recalcul ni l'affichage.

import type { ContexteTeam } from "@/core/contexte"
import { niveauDe } from "@/core/actions/actions-serveur"
import { recalculerPourQg as recalculerSaison } from "@/apps/saison/services-serveur"
import { recalculerPourQg as recalculerVoiture } from "@/apps/voiture/services-serveur"

export async function recalculerQg(contexte: ContexteTeam): Promise<void> {
  await lancer("saison", async () => recalculerSaison(contexte, await niveauDe(contexte, "saison")))
  await lancer("voiture", async () => recalculerVoiture(contexte, await niveauDe(contexte, "voiture")))
}

async function lancer(app: string, recalcul: () => Promise<void>): Promise<void> {
  try {
    await recalcul()
  } catch (cause) {
    console.error(`[${app}] recalcul au QG :`, cause)
  }
}
