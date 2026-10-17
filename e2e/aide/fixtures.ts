// Fixture : une team jetable par scénario. Le nettoyage est dans le finally de la fixture,
// donc il s'exécute même quand le test échoue.
import { test as base, expect } from "@playwright/test"

import { creerEquipe, supprimerEquipe, type Equipe } from "./session"

export const test = base.extend<{ equipe: Equipe }>({
  equipe: async ({}, utiliser) => {
    const equipe = await creerEquipe()
    try {
      await utiliser(equipe)
    } finally {
      await supprimerEquipe(equipe)
    }
  },
  // La page dépend de la team : Playwright la ferme avant de supprimer la team, sinon les
  // préchargements et le service worker tournent encore sur une team effacée.
  page: async ({ page, equipe: _equipe }, utiliser) => {
    await utiliser(page)
    // On laisse finir les requêtes et les événements du bus en cours avant de supprimer la team.
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 300))
  },
})

export { expect }
